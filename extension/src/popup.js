import { extractJob } from "./extract.js";
import { jobKey, jobKeyHash, jobKeyPrefix } from "./jobKey.js";
import {
  MIN_DESCRIPTION_CHARS,
  canonicalJobUrl,
  matchUrl,
  reportUrl,
  saveJobUrl,
  saveUrl,
  signalsLookupUrl,
} from "./links.js";
import { signLines } from "./signs.js";

const LOOKUP_TIMEOUT_MS = 3000;

/**
 * The public signals for this job, or null. Sends only the first 4 hex
 * characters of the job key hash and matches the full hash here, so the
 * server never learns which job is open.
 */
export async function lookupSignals(fetchImpl, hash) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetchImpl(signalsLookupUrl(jobKeyPrefix(hash)), { signal: controller.signal, credentials: "omit" });
    if (!response.ok) return null;
    const { entries } = await response.json();
    return Array.isArray(entries) ? (entries.find((entry) => entry?.hash === hash) ?? null) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reads the active tab once (activeTab grants access because the user opened
 * the popup), then wires the two buttons. When it finds the job description,
 * Save sends what it read (editable here) and nothing gets scraped; otherwise
 * Save sends the link for the server to read. Takes its globals as arguments so
 * tests can run it against a fake chrome API.
 */
export async function startPopup({ chrome, document, window, fetch: fetchImpl = globalThis.fetch }) {
  const jobSection = document.getElementById("job");
  const jobForm = document.getElementById("job-form");
  const fields = {
    title: document.getElementById("field-title"),
    company: document.getElementById("field-company"),
    location: document.getElementById("field-location"),
  };
  const saveButton = document.getElementById("save");
  const matchButton = document.getElementById("match");
  const hint = document.getElementById("hint");

  function showHint(text) {
    hint.textContent = text;
    hint.hidden = !text;
  }

  function renderJob({ title, meta }) {
    jobSection.replaceChildren();
    const titleElement = document.createElement("p");
    titleElement.className = "job-title";
    titleElement.textContent = title;
    jobSection.append(titleElement);
    if (meta) {
      const metaElement = document.createElement("p");
      metaElement.className = "job-meta";
      metaElement.textContent = meta;
      jobSection.append(metaElement);
    }
  }

  async function showSignals(hash, company) {
    const section = document.getElementById("signals");
    const list = document.getElementById("signal-list");
    const reportLink = document.getElementById("report");
    reportLink.addEventListener("click", (event) => {
      event.preventDefault();
      openAndClose(reportUrl(hash, jobUrl));
    });
    section.classList.add("signals-empty");
    section.hidden = false;
    const entry = await lookupSignals(fetchImpl, hash);
    const lines = signLines(entry && { signs: entry.signs, reports: entry.reports }, company, new Date());
    list.replaceChildren(
      ...lines.map((line) => {
        const item = document.createElement("li");
        if (line.tone === "red") item.className = "red";
        const text = document.createElement("span");
        text.textContent = line.text;
        const source = document.createElement("span");
        source.className = "signal-source";
        source.textContent = line.source;
        const body = document.createElement("div");
        body.append(text, source);
        item.append(body);
        return item;
      }),
    );
    list.hidden = lines.length === 0;
    // No amber box around a plain "Report" link
    section.classList.toggle("signals-empty", lines.length === 0);
  }

  async function openAndClose(url) {
    await chrome.tabs.create({ url });
    window.close();
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const jobUrl = tab?.url ? canonicalJobUrl(tab.url) : null;
  if (!tab?.id || !jobUrl) {
    renderJob({ title: "Open a job posting", meta: "Then click OpenApply to save it or check your resume against it." });
    return;
  }

  let job = null;
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractJob,
    });
    job = injection?.result ?? null;
  } catch {
    // Chrome blocks scripts on its own pages and the Web Store; saving the link still works
  }

  const host = new URL(jobUrl).hostname.replace(/^www\./, "");
  const description = job?.description ?? "";
  const foundDescription = description.length >= MIN_DESCRIPTION_CHARS;

  let saving = false;
  async function save() {
    if (saving) return;
    saving = true;
    saveButton.disabled = true;
    const url = foundDescription
      ? await saveJobUrl({
        url: jobUrl,
        title: fields.title.value,
        company: fields.company.value,
        location: fields.location.value,
        description,
        salary: job.salary,
        posting: job.posting,
      })
      : saveUrl(jobUrl);
    await openAndClose(url);
  }

  if (foundDescription) {
    jobSection.hidden = true;
    jobForm.hidden = false;
    fields.title.value = job.title || tab.title || "";
    fields.company.value = job.company || "";
    fields.location.value = job.location || "";
    const characters = description.length.toLocaleString("en-US");
    document.getElementById("description-note").textContent = job.source === "selection"
      ? `Job description: the ${characters} characters you selected`
      : `Job description: ${characters} characters from ${host}`;
    jobForm.addEventListener("submit", (event) => {
      event.preventDefault();
      save();
    });
  } else {
    renderJob({
      title: job?.title || tab.title || host,
      meta: [job?.company, host].filter(Boolean).join(" · "),
    });
  }

  saveButton.disabled = false;
  saveButton.addEventListener("click", save);

  // Not awaited: the buttons work while the lookup runs
  const key = jobKey(tab.url);
  const signalsShown = key ? jobKeyHash(key).then((hash) => showSignals(hash, job?.company || "")) : Promise.resolve();

  if (foundDescription) {
    matchButton.disabled = false;
    matchButton.addEventListener("click", () => openAndClose(matchUrl({ description, url: jobUrl })));
  } else {
    showHint("Couldn't find the job description here. Select it on the page, then open OpenApply again. Save still works: we'll read the link.");
  }
  return { signalsShown };
}

if (globalThis.chrome?.tabs) {
  startPopup({ chrome: globalThis.chrome, document, window });
}
