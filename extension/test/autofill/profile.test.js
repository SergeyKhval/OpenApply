import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_RESUME_BYTES,
  cleanProfile,
  clearProfile,
  loadProfile,
  normalizeUrl,
  saveProfile,
  saveResume,
} from "../../src/autofill/profile.js";
import { startProfilePage } from "../../src/profile.js";

const here = dirname(fileURLToPath(import.meta.url));
const pageHtml = readFileSync(join(here, "../../src/profile.html"), "utf8");

// chrome.storage.local, in memory
function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    get: async (keys) => Object.fromEntries([keys].flat().filter((key) => key in data).map((key) => [key, data[key]])),
    set: async (items) => { Object.assign(data, structuredClone(items)); },
    remove: async (keys) => { [keys].flat().forEach((key) => delete data[key]); },
  };
}

const pdf = (bytes = 12, name = "Ada resume.pdf") => new File([new Uint8Array(bytes).fill(65)], name);

describe("normalizeUrl", () => {
  it.each([
    ["linkedin.com/in/ada", "https://linkedin.com/in/ada"],
    ["https://www.linkedin.com/in/ada/", "https://www.linkedin.com/in/ada/"],
    ["  github.com/ada ", "https://github.com/ada"],
    ["http://ada.dev", "http://ada.dev/"],
    ["", ""],
  ])("%s", (input, expected) => expect(normalizeUrl(input)).toBe(expected));

  it.each(["javascript:alert(1)", "ada", "mailto:ada@example.com", "https://"])("rejects %s", (input) => {
    expect(normalizeUrl(input)).toBeNull();
  });
});

describe("cleanProfile", () => {
  it("trims, drops blanks and adds https to links", () => {
    const { profile, errors } = cleanProfile({
      firstName: "  Ada ",
      lastName: "",
      email: "ada@example.com",
      linkedin: "linkedin.com/in/ada",
      company: "Analytical   Engines",
      unknown: "ignored",
    });
    expect(errors).toEqual({});
    expect(profile).toEqual({
      firstName: "Ada",
      email: "ada@example.com",
      linkedin: "https://linkedin.com/in/ada",
      company: "Analytical Engines",
    });
  });

  it("flags a bad email and a link that isn't a web address", () => {
    const { profile, errors } = cleanProfile({ email: "ada at example", portfolio: "javascript:void(0)" });
    expect(Object.keys(errors)).toEqual(["email", "portfolio"]);
    expect(profile).toEqual({});
  });
});

describe("profile storage", () => {
  it("saves and loads the profile and the resume", async () => {
    const storage = fakeStorage();
    await saveProfile(storage, { firstName: "Ada" });
    const { resume } = await saveResume(storage, pdf(3));
    expect(resume).toEqual({ name: "Ada resume.pdf", type: "application/pdf", base64: btoa("AAA") });
    expect(await loadProfile(storage)).toEqual({ profile: { firstName: "Ada" }, resume });
  });

  it("starts empty", async () => {
    expect(await loadProfile(fakeStorage())).toEqual({ profile: {}, resume: null });
  });

  it("encodes a large file without overflowing the stack", async () => {
    const { resume } = await saveResume(fakeStorage(), pdf(MAX_RESUME_BYTES));
    expect(atob(resume.base64)).toHaveLength(MAX_RESUME_BYTES);
  });

  it.each([
    [pdf(MAX_RESUME_BYTES + 1), "over 5 MB"],
    [pdf(0), "empty"],
    [pdf(10, "resume.png"), "PDF or Word"],
  ])("refuses %#", async (file, message) => {
    const storage = fakeStorage();
    const { error } = await saveResume(storage, file);
    expect(error).toContain(message);
    expect(storage.data).toEqual({});
  });

  it("takes Word files", async () => {
    const { resume } = await saveResume(fakeStorage(), pdf(5, "cv.docx"));
    expect(resume.type).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  });

  it("clears everything", async () => {
    const storage = fakeStorage({ autofillProfile: { firstName: "Ada" }, autofillResume: { name: "a.pdf" }, other: 1 });
    await clearProfile(storage);
    expect(storage.data).toEqual({ other: 1 });
  });
});

describe("profile page", () => {
  let storage;
  const byId = (id) => document.getElementById(id);
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  async function open(initial) {
    document.documentElement.innerHTML = pageHtml.replace(/^<!doctype html>/i, "");
    storage = fakeStorage(initial);
    await startProfilePage({ chrome: { storage: { local: storage } }, document });
  }

  function chooseFile(file) {
    const input = byId("resume-input");
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new Event("change"));
  }

  beforeEach(() => open());

  it("shows every field, labelled, with the stored values", async () => {
    await open({ autofillProfile: { firstName: "Ada", github: "https://github.com/ada" }, autofillResume: { name: "cv.pdf" } });
    const labels = [...document.querySelectorAll(".field > span:first-child")].map((span) => span.textContent);
    expect(labels).toEqual(["First name", "Last name", "Email", "Phone", "LinkedIn", "GitHub", "Website or portfolio", "Current company"]);
    expect(byId("profile-firstName").value).toBe("Ada");
    expect(byId("profile-github").value).toBe("https://github.com/ada");
    expect(byId("resume-name").textContent).toBe("cv.pdf");
    expect(byId("resume-remove").hidden).toBe(false);
  });

  it("saves the cleaned profile", async () => {
    byId("profile-firstName").value = " Ada ";
    byId("profile-linkedin").value = "linkedin.com/in/ada";
    byId("profile-form").dispatchEvent(new Event("submit", { cancelable: true }));
    await flush();
    expect(storage.data.autofillProfile).toEqual({ firstName: "Ada", linkedin: "https://linkedin.com/in/ada" });
    expect(byId("profile-linkedin").value).toBe("https://linkedin.com/in/ada");
    expect(byId("status").textContent).toBe("Saved on this device.");
  });

  it("doesn't save with a bad email, and says why next to the field", async () => {
    byId("profile-email").value = "ada";
    byId("profile-form").dispatchEvent(new Event("submit", { cancelable: true }));
    await flush();
    expect(storage.data).toEqual({});
    expect(byId("profile-email-error").hidden).toBe(false);
    expect(byId("profile-email").getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(byId("profile-email"));
  });

  it("stores a picked resume and can remove it", async () => {
    chooseFile(pdf(4, "Ada.pdf"));
    await flush();
    expect(storage.data.autofillResume.name).toBe("Ada.pdf");
    expect(byId("resume-name").textContent).toBe("Ada.pdf");
    expect(byId("resume-choose").textContent).toBe("Replace file");

    byId("resume-remove").click();
    await flush();
    expect(storage.data.autofillResume).toBeUndefined();
    expect(byId("resume-name").textContent).toBe("No file yet");
  });

  it("explains a refused file and keeps the old one", async () => {
    await open({ autofillResume: { name: "old.pdf" } });
    chooseFile(pdf(10, "photo.jpg"));
    await flush();
    expect(byId("resume-error").hidden).toBe(false);
    expect(storage.data.autofillResume).toEqual({ name: "old.pdf" });
    expect(byId("resume-name").textContent).toBe("old.pdf");
  });

  it("deletes the whole profile", async () => {
    await open({ autofillProfile: { firstName: "Ada" }, autofillResume: { name: "cv.pdf" } });
    byId("clear").click();
    await flush();
    expect(storage.data).toEqual({});
    expect(byId("profile-firstName").value).toBe("");
    expect(byId("resume-name").textContent).toBe("No file yet");
  });

  it("uses no em dashes in its copy", () => {
    expect(pageHtml).not.toContain("—");
  });
});
