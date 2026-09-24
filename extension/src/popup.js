import { extractJob } from "./extract.js";
import { MIN_DESCRIPTION_CHARS, canonicalJobUrl, matchUrl, saveUrl } from "./links.js";

/**
 * Reads the active tab once (activeTab grants access because the user opened
 * the popup), then wires the two buttons. Takes its globals as arguments so
 * tests can run it against a fake chrome API.
 */
export async function startPopup({ chrome, document, window }) {
  const jobSection = document.getElementById("job");
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
  renderJob({
    title: job?.title || tab.title || host,
    meta: [job?.company, host].filter(Boolean).join(" · "),
  });

  saveButton.disabled = false;
  saveButton.addEventListener("click", () => openAndClose(saveUrl(jobUrl)));

  const description = job?.description ?? "";
  if (description.length >= MIN_DESCRIPTION_CHARS) {
    matchButton.disabled = false;
    matchButton.addEventListener("click", () => openAndClose(matchUrl({ description, url: jobUrl })));
    if (job.source === "selection") showHint("Using the text you selected as the job description.");
  } else {
    showHint("Couldn't find the job description here. Select it on the page, then open OpenApply again.");
  }
}

if (globalThis.chrome?.tabs) {
  startPopup({ chrome: globalThis.chrome, document, window });
}
