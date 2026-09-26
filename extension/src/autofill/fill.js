// Fills the contact fields of a Greenhouse, Lever or Ashby application form
// from the user's autofill profile. The popup injects this with
// chrome.scripting.executeScript({ func: fillForm, args }) only after the user
// clicks Fill, so Chrome serializes it on its own: keep every helper inside it.
//
// It fills only fields it is sure of, never overwrites what's already there,
// never touches questions, dropdowns, checkboxes or EEO/work authorization
// fields, and never submits the form.

/**
 * @typedef {Object} AutofillProfile
 * @property {string} [firstName]
 * @property {string} [lastName]
 * @property {string} [email]
 * @property {string} [phone]
 * @property {string} [linkedin]   profile URL
 * @property {string} [github]     profile URL
 * @property {string} [portfolio]  personal site URL
 * @property {string} [company]    current company
 */

/**
 * @typedef {Object} ResumeFile
 * @property {string} name    "Ada Lovelace resume.pdf"
 * @property {string} type    MIME type
 * @property {string} base64  file contents
 */

/**
 * @typedef {Object} FilledField
 * @property {string} field  profile key, or "resume"
 * @property {string} label  the form's own label for it
 */

/**
 * @typedef {Object} FillResult
 * @property {"greenhouse"|"lever"|"ashby"|null} ats
 * @property {boolean} formFound       the ATS's application form is on this page
 * @property {FilledField[]} filled    filled and still holding the value
 * @property {FilledField[]} kept      already had a value, left as it was
 * @property {FilledField[]} rejected  the page cleared or changed what we set
 * @property {string[]} left           labels of required fields still empty, for the user
 * @property {string|null} embeddedForm URL of an application form in a frame we can't reach
 */

/**
 * @param {AutofillProfile} profile
 * @param {ResumeFile|null} resume
 * @param {{ settleMs?: number }} [options] how long the page gets to react before we read values back
 * @returns {Promise<FillResult>}
 */
export async function fillForm(profile, resume, { settleMs = 400 } = {}) {
  // Exact labels only (lowercased, without "*", "(optional)" or a trailing ":"),
  // and only on text-like inputs: Notion has a "LinkedIn" checkbox under
  // "How did you hear about us"
  const LABELS = {
    phone: ["phone", "phone number", "mobile", "mobile number", "mobile phone", "mobile phone number"],
    linkedin: ["linkedin", "linkedin profile", "linkedin url", "linkedin profile url", "linkedin link"],
    github: ["github", "github profile", "github url", "github profile url"],
    portfolio: ["portfolio", "portfolio url", "website", "personal website", "portfolio / website", "website / portfolio"],
    company: ["current company", "current employer"],
  };
  const TEXT_TYPES = new Set(["text", "tel", "url", "email"]);

  // Hostname plus an element only the application form has. `fields` maps a
  // profile key to a selector; keys without one are found by label.
  const ATS = [
    {
      id: "greenhouse",
      hosts: /^(job-boards|boards)(\.eu)?\.greenhouse\.io$/,
      form: "#first_name, #email",
      fields: {
        firstName: "#first_name",
        lastName: "#last_name",
        email: "#email",
        phone: "#phone",
      },
      byLabel: ["linkedin", "github", "portfolio", "company"],
      resume: "input[type=file]#resume",
    },
    {
      id: "lever",
      hosts: /^jobs(\.eu)?\.lever\.co$/,
      form: "input[name=email]",
      fields: {
        fullName: "input[name=name]",
        email: "input[name=email]",
        phone: "input[name=phone]",
        company: "input[name=org]",
        linkedin: 'input[name="urls[LinkedIn]"]',
        github: 'input[name="urls[GitHub]"]',
        portfolio: 'input[name="urls[Portfolio]"]',
      },
      byLabel: [],
      resume: "input[type=file][name=resume]",
    },
    {
      id: "ashby",
      hosts: /^jobs\.ashbyhq\.com$/,
      form: "#_systemfield_email",
      fields: {
        fullName: "#_systemfield_name",
        email: "#_systemfield_email",
      },
      byLabel: ["phone", "linkedin", "github", "portfolio", "company"],
      // Not the unnamed "Autofill from resume" input at the top of the form
      resume: "input[type=file]#_systemfield_resume",
    },
  ];
  const EMBED = /^https:\/\/((job-boards|boards)(\.eu)?\.greenhouse\.io\/embed\/|jobs(\.eu)?\.lever\.co\/|jobs\.ashbyhq\.com\/)/;
  const MARK = "data-openapply-filled";

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const clean = (text) => (text || "").replace(/\s+/g, " ").trim();

  function labelOf(element) {
    const byFor = element.id && document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
    if (byFor) return clean(byFor.textContent);
    const wrapping = element.closest("label");
    if (!wrapping) return clean(element.getAttribute("aria-label"));
    // Lever wraps the caption and the field (with its upload or location
    // widget text) in one label: keep only the caption
    const caption = [...wrapping.children].filter((child) => !child.contains(element));
    return clean((caption.length ? caption : [wrapping]).map((part) => part.textContent).join(" "));
  }

  const isChoice = (element) => element.type === "checkbox" || element.type === "radio";

  // A radio or checkbox's own label is the option ("Yes"): the question is the
  // nearest caption before it that isn't another option's label
  function questionOf(element) {
    for (let node = element.parentElement, depth = 0; node && depth < 8; node = node.parentElement, depth++) {
      const caption = [...node.querySelectorAll("legend, label, .application-label")].find((candidate) => {
        if (candidate.contains(element) || candidate.querySelector("input")) return false;
        const target = candidate.htmlFor && document.getElementById(candidate.htmlFor);
        if (target && isChoice(target)) return false;
        return Boolean(candidate.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING);
      });
      if (caption) return clean(caption.textContent);
    }
    return "";
  }

  // The label as the form shows it, without the required-field star
  const bare = (label) => label.replace(/[*✱]/g, "").trim();

  function normalized(label) {
    return label.toLowerCase()
      .replace(/[*✱]/g, "")
      .replace(/\(optional\)/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/:$/, "")
      .trim();
  }

  function isTextInput(element) {
    return element instanceof HTMLInputElement
      && TEXT_TYPES.has((element.getAttribute("type") || "text").toLowerCase())
      && !element.disabled && !element.readOnly
      && element.getAttribute("role") !== "combobox"
      && element.getAttribute("autocomplete") !== "list";
  }

  function byLabel(key) {
    const wanted = LABELS[key];
    const matches = [...document.querySelectorAll("input")]
      .filter((element) => isTextInput(element) && wanted.includes(normalized(labelOf(element))));
    // Two fields with the same label: we can't tell which one is meant
    return matches.length === 1 ? matches[0] : null;
  }

  // React and friends track the value through the prototype setter, so a plain
  // `element.value = x` is thrown away on the next render
  function setValue(element, value) {
    element.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.blur();
  }

  // Greenhouse turns "+1 415 555 0100" into "+1 415-555-0100"
  function holds(element, key, value) {
    if (key === "phone") return element.value.replace(/\D/g, "") === value.replace(/\D/g, "");
    return clean(element.value) === clean(value);
  }

  function mark(element) {
    element.setAttribute(MARK, "");
    element.style.outline = "2px solid #7c3aed";
    element.style.outlineOffset = "1px";
    // Only a real keystroke clears the mark, not the events we dispatched
    element.addEventListener("input", function unmark(event) {
      if (!event.isTrusted) return;
      element.removeAttribute(MARK);
      element.style.outline = "";
      element.style.outlineOffset = "";
      element.removeEventListener("input", unmark);
    });
  }

  function requiredLabels(except) {
    const seen = new Set();
    const labels = new Set();
    for (const element of document.querySelectorAll("input, textarea, select")) {
      if (except.has(element) || element.type === "hidden" || element.type === "file") continue;
      const required = element.required || element.getAttribute("aria-required") === "true";
      if (!required) continue;
      if (isChoice(element)
        ? document.querySelector(`input[name="${CSS.escape(element.name)}"]:checked`)
        : element.value) continue;
      const group = element.name || element.id;
      if (group && seen.has(group)) continue;
      if (group) seen.add(group);
      const label = bare(isChoice(element) ? questionOf(element) : labelOf(element));
      if (label) labels.add(label);
    }
    return [...labels];
  }

  const embed = [...document.querySelectorAll("iframe[src]")].find((frame) => EMBED.test(frame.src));
  const result = {
    ats: null,
    formFound: false,
    filled: [],
    kept: [],
    rejected: [],
    left: [],
    embeddedForm: embed ? embed.src : null,
  };

  const ats = ATS.find((candidate) => candidate.hosts.test(location.hostname));
  if (!ats) return result;
  result.ats = ats.id;
  if (!document.querySelector(ats.form)) return result;
  result.formFound = true;

  const values = {
    ...profile,
    fullName: [profile.firstName, profile.lastName].map(clean).filter(Boolean).join(" "),
  };
  const touched = new Set();
  const pending = [];

  const targets = [
    ...Object.entries(ats.fields).map(([key, selector]) => [key, document.querySelector(selector)]),
    ...ats.byLabel.map((key) => [key, byLabel(key)]),
  ];
  for (const [key, element] of targets) {
    const value = clean(values[key]);
    if (!element || !value || touched.has(element) || !isTextInput(element)) continue;
    touched.add(element);
    const field = { field: key, label: bare(labelOf(element)) || key };
    if (element.value.trim()) {
      result.kept.push(field);
      continue;
    }
    setValue(element, value);
    pending.push({ element, key, value, field });
  }

  // Text first, file last: an ATS that reads the resume (Lever) then finds our
  // values already in place instead of racing us for the same fields
  const fileInput = resume && document.querySelector(ats.resume);
  let fileResult = null;
  if (fileInput) {
    // Greenhouse labels its file button "Attach"
    const field = { field: "resume", label: "Resume" };
    if (fileInput.files && fileInput.files.length) {
      result.kept.push(field);
    } else {
      const bytes = Uint8Array.from(atob(resume.base64), (character) => character.charCodeAt(0));
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], resume.name, { type: resume.type }));
      fileInput.files = transfer.files;
      fileInput.dispatchEvent(new Event("input", { bubbles: true }));
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      fileResult = [fileInput.files.length === 1 ? result.filled : result.rejected, field];
    }
  }

  await sleep(settleMs);
  for (const { element, key, value, field } of pending) {
    if (element.isConnected && holds(element, key, value)) {
      result.filled.push(field);
      mark(element);
    } else {
      result.rejected.push(field);
    }
  }
  if (fileResult) fileResult[0].push(fileResult[1]);
  result.left = requiredLabels(touched);
  return result;
}
