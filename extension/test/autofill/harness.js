import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const here = dirname(fileURLToPath(import.meta.url));

const source = readFileSync(join(here, "../../src/autofill/fill.js"), "utf8")
  .replace("export async function fillForm", "async function fillForm");

export const PROFILE = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  phone: "+1 415 555 0100",
  linkedin: "https://www.linkedin.com/in/ada",
  github: "https://github.com/ada",
  portfolio: "https://ada.dev",
  company: "Analytical Engines",
};

export const RESUME = { name: "Ada Lovelace resume.pdf", type: "application/pdf", base64: btoa("%PDF-1.4 test") };

/**
 * A page built from a saved form, with what jsdom lacks (CSS.escape,
 * DataTransfer, a writable files list) and spies on every way to submit
 */
export function formPage(fixture, { url, edit, html: rawHtml } = {}) {
  let html = rawHtml ?? readFileSync(join(here, `../fixtures/${fixture}.html`), "utf8");
  if (edit) html = edit(html);
  const pageUrl = url ?? html.match(/Captured (\S+)/)[1];
  const dom = new JSDOM(html, { url: pageUrl, runScripts: "outside-only" });
  const { window } = dom;
  window.CSS = { escape: (value) => String(value).replace(/["\\\]\[]/g, "\\$&") };
  window.DataTransfer = class {
    constructor() {
      const files = [];
      this.files = files;
      this.items = { add: (file) => files.push(file) };
    }
  };
  const storedFiles = new WeakMap();
  Object.defineProperty(window.HTMLInputElement.prototype, "files", {
    get() { return storedFiles.get(this) ?? []; },
    set(files) { storedFiles.set(this, files); },
  });
  const submits = [];
  window.HTMLFormElement.prototype.submit = () => submits.push("submit");
  window.HTMLFormElement.prototype.requestSubmit = () => submits.push("requestSubmit");
  const click = window.HTMLElement.prototype.click;
  window.HTMLElement.prototype.click = function () {
    submits.push(`click ${this.tagName}`);
    return click.call(this);
  };
  window.addEventListener("submit", () => submits.push("submit event"), true);
  return {
    window,
    document: window.document,
    submits,
    fill: (profile = PROFILE, resume = RESUME) =>
      window.eval(`${source}; fillForm(${JSON.stringify(profile)}, ${JSON.stringify(resume)}, { settleMs: 0 })`),
  };
}
