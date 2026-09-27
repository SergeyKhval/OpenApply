// The autofill profile: contact details and a resume file, kept in
// chrome.storage.local on this device only. The extension never sends them to
// OpenApply; they go into an application form when the user clicks Fill.

const PROFILE_KEY = "autofillProfile";
const RESUME_KEY = "autofillResume";

// chrome.storage.local holds 10 MB without the unlimitedStorage permission, and
// base64 adds a third
export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

const RESUME_TYPES = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/**
 * The profile form's fields, in the order the page shows them
 * @type {{ key: keyof import("./fill.js").AutofillProfile, label: string, type: string, autocomplete: string, placeholder?: string }[]}
 */
export const PROFILE_FIELDS = [
  { key: "firstName", label: "First name", type: "text", autocomplete: "given-name" },
  { key: "lastName", label: "Last name", type: "text", autocomplete: "family-name" },
  { key: "email", label: "Email", type: "email", autocomplete: "email" },
  { key: "phone", label: "Phone", type: "tel", autocomplete: "tel", placeholder: "+1 415 555 0100" },
  { key: "linkedin", label: "LinkedIn", type: "url", autocomplete: "url", placeholder: "linkedin.com/in/you" },
  { key: "github", label: "GitHub", type: "url", autocomplete: "url", placeholder: "github.com/you" },
  { key: "portfolio", label: "Website or portfolio", type: "url", autocomplete: "url", placeholder: "you.dev" },
  { key: "company", label: "Current company", type: "text", autocomplete: "organization" },
];

const URL_KEYS = new Set(["linkedin", "github", "portfolio"]);

/**
 * "linkedin.com/in/ada" becomes "https://linkedin.com/in/ada". Returns null
 * for anything that isn't an http(s) address.
 */
export function normalizeUrl(value) {
  const text = value.trim();
  if (!text) return "";
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.href;
  } catch {
    return null;
  }
}

/**
 * Trims every field and checks the email and links
 * @returns {{ profile: import("./fill.js").AutofillProfile, errors: Record<string, string> }}
 */
export function cleanProfile(input) {
  const profile = {};
  const errors = {};
  for (const { key } of PROFILE_FIELDS) {
    const value = String(input[key] ?? "").replace(/\s+/g, " ").trim();
    if (!value) continue;
    if (key === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      errors[key] = "That doesn't look like an email address.";
    } else if (URL_KEYS.has(key)) {
      const url = normalizeUrl(value);
      if (url === null) errors[key] = "Enter a web address, like linkedin.com/in/you.";
      else profile[key] = url;
    } else {
      profile[key] = value;
    }
  }
  return { profile, errors };
}

/**
 * @param {chrome.storage.StorageArea} storage
 * @returns {Promise<{ profile: import("./fill.js").AutofillProfile, resume: import("./fill.js").ResumeFile | null }>}
 */
export async function loadProfile(storage) {
  const stored = await storage.get([PROFILE_KEY, RESUME_KEY]);
  return { profile: stored[PROFILE_KEY] ?? {}, resume: stored[RESUME_KEY] ?? null };
}

export async function saveProfile(storage, profile) {
  await storage.set({ [PROFILE_KEY]: profile });
}

/**
 * Checks and stores the file the user picked
 * @param {File} file
 * @returns {Promise<{ resume?: import("./fill.js").ResumeFile, error?: string }>}
 */
export async function saveResume(storage, file) {
  const extension = file.name.split(".").pop().toLowerCase();
  const type = RESUME_TYPES[extension];
  if (!type) return { error: "Choose a PDF or Word file." };
  if (file.size > MAX_RESUME_BYTES) return { error: "That file is over 5 MB. Most application forms won't take it either." };
  if (file.size === 0) return { error: "That file is empty." };
  const resume = { name: file.name, type, base64: toBase64(new Uint8Array(await file.arrayBuffer())) };
  await storage.set({ [RESUME_KEY]: resume });
  return { resume };
}

export async function removeResume(storage) {
  await storage.remove(RESUME_KEY);
}

export async function clearProfile(storage) {
  await storage.remove([PROFILE_KEY, RESUME_KEY]);
}

function toBase64(bytes) {
  let binary = "";
  // String.fromCharCode takes arguments, and a 5 MB spread would overflow the stack
  for (let start = 0; start < bytes.length; start += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  }
  return btoa(binary);
}
