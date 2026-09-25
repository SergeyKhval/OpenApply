import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { startPopup } from "../src/popup.js";
import { jobKeyHash } from "../src/jobKey.js";
import { decodeExtensionJob } from "../../shared/extensionJob.ts";

const here = dirname(fileURLToPath(import.meta.url));

const popupHtml = readFileSync(join(here, "../src/popup.html"), "utf8");
const description = "Build accessible Vue apps. ".repeat(20);

function fakeChrome({ tab, result, injectionError } = {}) {
  return {
    tabs: {
      query: vi.fn().mockResolvedValue(tab ? [tab] : []),
      create: vi.fn().mockResolvedValue({}),
    },
    scripting: {
      executeScript: injectionError
        ? vi.fn().mockRejectedValue(injectionError)
        : vi.fn().mockResolvedValue([{ result }]),
    },
  };
}

const jobTab = { id: 7, url: "https://www.linkedin.com/jobs/search/?currentJobId=42", title: "Jobs | LinkedIn" };
const button = (id) => document.getElementById(id);

describe("popup", () => {
  let fakeWindow;

  beforeEach(() => {
    document.documentElement.innerHTML = popupHtml.replace(/^<!doctype html>/i, "");
    fakeWindow = { close: vi.fn() };
    // No real network from tests: the signals lookup finds nothing
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
  });

  it("prefills what it read and saves it without the server", async () => {
    const chrome = fakeChrome({
      tab: jobTab,
      result: { title: "Frontend Engineer", company: "Acme", location: "Berlin", description, source: "site" },
    });
    await startPopup({ chrome, document, window: fakeWindow });

    expect(chrome.scripting.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({ target: { tabId: 7 } }),
    );
    expect(document.getElementById("job-form").hidden).toBe(false);
    expect(document.getElementById("field-title").value).toBe("Frontend Engineer");
    expect(document.getElementById("field-company").value).toBe("Acme");
    expect(document.getElementById("field-location").value).toBe("Berlin");
    expect(document.getElementById("description-note").textContent).toBe(
      `Job description: ${description.length} characters from linkedin.com`,
    );

    button("save").click();
    await vi.waitFor(() => expect(fakeWindow.close).toHaveBeenCalled());
    const opened = new URL(chrome.tabs.create.mock.calls[0][0].url);
    expect(opened.pathname).toBe("/save");
    expect(opened.searchParams.has("url")).toBe(false);
    await expect(decodeExtensionJob(opened.hash)).resolves.toEqual({
      url: "https://www.linkedin.com/jobs/view/42/",
      title: "Frontend Engineer",
      company: "Acme",
      location: "Berlin",
      description: description.trim(),
    });
  });

  it("saves the title and company the user fixed", async () => {
    const chrome = fakeChrome({
      tab: jobTab,
      result: { title: "Jobs | LinkedIn", company: "", location: "", description, source: "page" },
    });
    await startPopup({ chrome, document, window: fakeWindow });

    document.getElementById("field-title").value = "Staff Engineer";
    document.getElementById("field-company").value = "Globex";
    // Enter in a field saves too
    document.getElementById("job-form").requestSubmit();
    await vi.waitFor(() => expect(fakeWindow.close).toHaveBeenCalled());
    const job = await decodeExtensionJob(new URL(chrome.tabs.create.mock.calls[0][0].url).hash);
    expect(job).toMatchObject({ title: "Staff Engineer", company: "Globex" });
    expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
  });

  it("sends the job description to the match tool", async () => {
    const chrome = fakeChrome({
      tab: jobTab,
      result: { title: "Frontend Engineer", company: "Acme", description, source: "site" },
    });
    await startPopup({ chrome, document, window: fakeWindow });

    expect(button("match").disabled).toBe(false);
    button("match").click();
    await vi.waitFor(() => expect(chrome.tabs.create).toHaveBeenCalled());
    const opened = new URL(chrome.tabs.create.mock.calls[0][0].url);
    expect(opened.pathname).toBe("/tools/resume-job-match");
    expect(new URLSearchParams(opened.hash.slice(1)).get("jd")).toBe(description);
  });

  it("falls back to saving the link when there's no description", async () => {
    const chrome = fakeChrome({ tab: jobTab, result: { title: "", company: "", description: "", source: "none" } });
    await startPopup({ chrome, document, window: fakeWindow });

    expect(button("save").disabled).toBe(false);
    expect(button("match").disabled).toBe(true);
    expect(button("hint").hidden).toBe(false);
    expect(document.getElementById("job-form").hidden).toBe(true);
    expect(document.querySelector(".job-title").textContent).toBe("Jobs | LinkedIn");

    button("save").click();
    await vi.waitFor(() => expect(fakeWindow.close).toHaveBeenCalled());
    const opened = new URL(chrome.tabs.create.mock.calls[0][0].url);
    expect(opened.searchParams.get("url")).toBe("https://www.linkedin.com/jobs/view/42/");
    expect(opened.hash).toBe("");
  });

  it("says when it's using the selected text", async () => {
    const chrome = fakeChrome({
      tab: jobTab,
      result: { title: "Frontend Engineer", company: "", description, source: "selection" },
    });
    await startPopup({ chrome, document, window: fakeWindow });
    expect(document.getElementById("description-note").textContent).toContain("characters you selected");
  });

  it("saves the link even where Chrome blocks page scripts", async () => {
    const chrome = fakeChrome({ tab: jobTab, injectionError: new Error("Cannot access contents of the page") });
    await startPopup({ chrome, document, window: fakeWindow });
    expect(button("save").disabled).toBe(false);
    expect(button("match").disabled).toBe(true);

    button("save").click();
    await vi.waitFor(() => expect(fakeWindow.close).toHaveBeenCalled());
    expect(new URL(chrome.tabs.create.mock.calls[0][0].url).searchParams.has("url")).toBe(true);
  });

  it("does nothing on browser pages", async () => {
    const chrome = fakeChrome({ tab: { id: 1, url: "chrome://newtab/" } });
    await startPopup({ chrome, document, window: fakeWindow });
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
    expect(button("save").disabled).toBe(true);
    expect(document.querySelector(".job-title").textContent).toBe("Open a job posting");
  });

  it("renders page text as text, not HTML", async () => {
    const withDescription = fakeChrome({
      tab: jobTab,
      result: { title: "<b>x</b>", company: "<img src=x onerror=alert(1)>", description, source: "site" },
    });
    await startPopup({ chrome: withDescription, document, window: fakeWindow });
    expect(document.querySelector("#job-form img, #job-form b")).toBeNull();
    expect(document.getElementById("field-company").value).toBe("<img src=x onerror=alert(1)>");
    document.documentElement.innerHTML = popupHtml.replace(/^<!doctype html>/i, "");

    const chrome = fakeChrome({
      tab: jobTab,
      result: { title: "<img src=x onerror=alert(1)>", company: "", description: "", source: "none" },
    });
    await startPopup({ chrome, document, window: fakeWindow });
    expect(document.querySelector("#job img")).toBeNull();
    expect(document.querySelector(".job-title").textContent).toBe("<img src=x onerror=alert(1)>");
  });
});

describe("posting signals", () => {
  const greenhouseTab = { id: 9, url: "https://job-boards.greenhouse.io/workato/jobs/8181689002?gh_src=abc", title: "Analyst" };
  let fakeWindow;
  let hash;

  beforeEach(async () => {
    document.documentElement.innerHTML = popupHtml.replace(/^<!doctype html>/i, "");
    fakeWindow = { close: vi.fn() };
    hash = await jobKeyHash("greenhouse:8181689002");
  });

  const bucket = (entries) => vi.fn().mockResolvedValue({ ok: true, json: async () => ({ entries }) });

  it("sends only the 4-character prefix and matches the full hash locally", async () => {
    const fetch = bucket([
      { hash: `${hash.slice(0, 4)}ffff`, signs: { firstSeenAt: "2026-01-01", openApplication: true }, reports: null },
      {
        hash,
        signs: { firstSeenAt: "2026-01-10", stillListed: { since: "2026-01-10", lastListedAt: "2026-09-20" } },
        reports: { asked_for_money: { days: [new Date().toISOString().slice(0, 10), new Date().toISOString().slice(0, 10), new Date().toISOString().slice(0, 10)] } },
      },
    ]);
    const chrome = fakeChrome({ tab: greenhouseTab, result: { title: "Analyst", company: "Workato", description, source: "site" } });
    const { signalsShown } = await startPopup({ chrome, document, window: fakeWindow, fetch });
    await signalsShown;

    const requested = new URL(fetch.mock.calls[0][0]);
    expect(requested.origin + requested.pathname).toBe("https://openapply.app/api/job-signals");
    expect(requested.search).toBe(`?p=${hash.slice(0, 4)}`);
    expect(fetch.mock.calls[0][0]).not.toContain(hash);
    expect(fetch.mock.calls[0][0]).not.toContain("greenhouse");

    const items = [...document.querySelectorAll("#signal-list li")];
    expect(items.map((item) => item.className)).toEqual(["red", ""]);
    expect(items[0].textContent).toContain("3 people reported being asked to pay");
    expect(items[1].textContent).toContain("Still listed 8 months after it was first saved on OpenApply");
    expect(document.getElementById("signals").classList.contains("signals-empty")).toBe(false);
    // The other job in the bucket isn't shown
    expect(document.body.textContent).not.toContain("Open application");
  });

  it("shows just the Report link when there's nothing, and it opens the app", async () => {
    const chrome = fakeChrome({ tab: greenhouseTab, result: null });
    const { signalsShown } = await startPopup({ chrome, document, window: fakeWindow, fetch: bucket([]) });
    await signalsShown;
    expect(document.getElementById("signal-list").hidden).toBe(true);
    expect(document.getElementById("signals").classList.contains("signals-empty")).toBe(true);

    document.getElementById("report").click();
    await vi.waitFor(() => expect(fakeWindow.close).toHaveBeenCalled());
    const opened = new URL(chrome.tabs.create.mock.calls[0][0].url);
    expect(opened.pathname).toBe("/app/jobs/report");
    expect(opened.searchParams.get("job")).toBe(hash);
  });

  it("stays quiet when the lookup fails or times out", async () => {
    const chrome = fakeChrome({ tab: greenhouseTab, result: null });
    const fetch = vi.fn().mockRejectedValue(new Error("offline"));
    const { signalsShown } = await startPopup({ chrome, document, window: fakeWindow, fetch });
    await signalsShown;
    expect(document.getElementById("signal-list").hidden).toBe(true);
    expect(button("save").disabled).toBe(false);
  });
});
