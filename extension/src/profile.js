import {
  PROFILE_FIELDS,
  cleanProfile,
  clearProfile,
  loadProfile,
  removeResume,
  saveProfile,
  saveResume,
} from "./autofill/profile.js";

/**
 * The autofill profile page: builds the fields, loads what's stored, saves on
 * submit. Takes its globals as arguments so tests can run it against a fake
 * chrome API.
 */
export async function startProfilePage({ chrome, document }) {
  const storage = chrome.storage.local;
  const form = document.getElementById("profile-form");
  const status = document.getElementById("status");
  const resumeName = document.getElementById("resume-name");
  const resumeInput = document.getElementById("resume-input");
  const resumeChoose = document.getElementById("resume-choose");
  const resumeRemove = document.getElementById("resume-remove");
  const resumeError = document.getElementById("resume-error");

  const inputs = {};
  const errors = {};
  document.getElementById("fields").replaceChildren(...PROFILE_FIELDS.map((field) => {
    const wrapper = document.createElement("label");
    wrapper.className = "field";
    const caption = document.createElement("span");
    caption.textContent = field.label;
    const input = document.createElement("input");
    input.id = `profile-${field.key}`;
    input.name = field.key;
    input.type = field.type;
    input.autocomplete = field.autocomplete;
    input.maxLength = 300;
    if (field.placeholder) input.placeholder = field.placeholder;
    const error = document.createElement("span");
    error.className = "error";
    error.id = `profile-${field.key}-error`;
    error.hidden = true;
    input.setAttribute("aria-describedby", error.id);
    wrapper.append(caption, input, error);
    inputs[field.key] = input;
    errors[field.key] = error;
    return wrapper;
  }));

  function showStatus(text) {
    status.textContent = text;
  }

  function showResume(resume) {
    resumeName.textContent = resume ? resume.name : "No file yet";
    resumeChoose.textContent = resume ? "Replace file" : "Choose file";
    resumeRemove.hidden = !resume;
  }

  function showResumeError(text) {
    resumeError.textContent = text;
    resumeError.hidden = !text;
  }

  const { profile, resume } = await loadProfile(storage);
  for (const [key, input] of Object.entries(inputs)) input.value = profile[key] ?? "";
  showResume(resume);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(Object.entries(inputs).map(([key, input]) => [key, input.value]));
    const { profile: cleaned, errors: problems } = cleanProfile(values);
    for (const [key, error] of Object.entries(errors)) {
      error.textContent = problems[key] ?? "";
      error.hidden = !problems[key];
      inputs[key].setAttribute("aria-invalid", problems[key] ? "true" : "false");
    }
    const firstProblem = Object.keys(problems)[0];
    if (firstProblem) {
      inputs[firstProblem].focus();
      showStatus("Not saved. Check the fields marked above.");
      return;
    }
    await saveProfile(storage, cleaned);
    // Show the links the way they're saved ("linkedin.com/in/you" gets https://)
    for (const [key, input] of Object.entries(inputs)) input.value = cleaned[key] ?? "";
    showStatus("Saved on this device.");
  });

  resumeInput.addEventListener("change", async () => {
    const [file] = resumeInput.files;
    resumeInput.value = "";
    if (!file) return;
    const { resume: saved, error } = await saveResume(storage, file);
    showResumeError(error ?? "");
    if (saved) {
      showResume(saved);
      showStatus("Resume saved on this device.");
    }
  });

  resumeRemove.addEventListener("click", async () => {
    await removeResume(storage);
    showResume(null);
    showStatus("Resume removed.");
  });

  document.getElementById("clear").addEventListener("click", async () => {
    await clearProfile(storage);
    for (const input of Object.values(inputs)) input.value = "";
    showResume(null);
    showResumeError("");
    showStatus("Autofill profile deleted from this device.");
  });
}

if (globalThis.chrome?.storage) {
  startProfilePage({ chrome: globalThis.chrome, document });
}
