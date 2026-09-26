import { describe, expect, it } from "vitest";
import { PROFILE, RESUME, formPage } from "./harness.js";

const fields = (list) => list.map((entry) => entry.field);

// Every control's value and checked state, to prove we changed only what we reported
function snapshot(document) {
  return [...document.querySelectorAll("input, textarea, select")]
    .map((element) => `${element.name || element.id}=${element.value}|${element.checked}`);
}

describe("fillForm on captured application forms", () => {
  it.each([
    // fixture, ATS, fields filled (resume always last)
    ["greenhouse-gitlab", "greenhouse", ["firstName", "lastName", "email", "phone", "linkedin", "resume"]],
    ["greenhouse-discord", "greenhouse", ["firstName", "lastName", "email", "phone", "linkedin", "resume"]],
    ["greenhouse-figma", "greenhouse", ["firstName", "lastName", "email", "phone", "linkedin", "resume"]],
    // Stripe asks for the employer as a question ("Who is your current or previous employer?"): not ours to answer
    ["greenhouse-embed-stripe", "greenhouse", ["firstName", "lastName", "email", "phone", "resume"]],
    ["lever-spotify", "lever", ["fullName", "email", "phone", "company", "linkedin", "github", "portfolio", "resume"]],
    ["lever-palantir", "lever", ["fullName", "email", "phone", "company", "linkedin", "github", "portfolio", "resume"]],
    ["lever-shieldai", "lever", ["fullName", "email", "phone", "company", "linkedin", "github", "portfolio", "resume"]],
    ["lever-zoox", "lever", ["fullName", "email", "phone", "company", "linkedin", "resume"]],
    ["ashby-linear", "ashby", ["fullName", "email", "linkedin", "github", "resume"]],
    ["ashby-openai", "ashby", ["fullName", "email", "phone", "resume"]],
    ["ashby-notion", "ashby", ["fullName", "email", "phone", "linkedin", "resume"]],
  ])("%s", async (fixture, ats, expected) => {
    const page = formPage(`forms/${fixture}`);
    const before = snapshot(page.document);
    const result = await page.fill();

    expect(result.ats).toBe(ats);
    expect(result.formFound).toBe(true);
    expect(fields(result.filled)).toEqual(expected);
    expect(result.kept).toEqual([]);
    expect(result.rejected).toEqual([]);
    expect(page.submits).toEqual([]);

    // Only the fields we reported changed: no question, dropdown, checkbox, EEO or consent field
    const changed = snapshot(page.document).filter((entry, index) => entry !== before[index]);
    expect(changed).toHaveLength(expected.filter((field) => field !== "resume").length);
    expect(page.document.querySelectorAll("[data-openapply-filled]")).toHaveLength(changed.length);
  });

  it("writes the values where they belong", async () => {
    const greenhouse = formPage("forms/greenhouse-gitlab");
    await greenhouse.fill();
    const value = (page, selector) => page.document.querySelector(selector).value;
    expect(value(greenhouse, "#first_name")).toBe("Ada");
    expect(value(greenhouse, "#last_name")).toBe("Lovelace");
    expect(value(greenhouse, "#phone")).toBe(PROFILE.phone);
    expect(value(greenhouse, "#question_36622854002")).toBe(PROFILE.linkedin);

    const lever = formPage("forms/lever-palantir");
    await lever.fill();
    expect(value(lever, "input[name=name]")).toBe("Ada Lovelace");
    expect(value(lever, "input[name=org]")).toBe(PROFILE.company);
    expect(value(lever, 'input[name="urls[GitHub]"]')).toBe(PROFILE.github);
    const [file] = lever.document.querySelector("input[name=resume]").files;
    expect(file.name).toBe(RESUME.name);
    expect(file.type).toBe("application/pdf");
    expect(await file.text()).toBe("%PDF-1.4 test");
  });

  it("uses the form's own labels in the result", async () => {
    const result = await formPage("forms/lever-spotify").fill();
    expect(result.filled.map((entry) => entry.label)).toEqual([
      "Full name", "Email", "Phone", "Current company", "LinkedIn URL", "GitHub URL", "Portfolio URL", "Resume",
    ]);
  });

  it("never ticks the 'How did you hear about us: LinkedIn' checkbox on Notion", async () => {
    const page = formPage("forms/ashby-notion");
    await page.fill();
    const checkbox = page.document.querySelector('input[type=checkbox][name="LinkedIn"]');
    expect(checkbox).not.toBeNull();
    expect(checkbox.checked).toBe(false);
  });

  it("lists the required questions left for the user, not the options", async () => {
    const result = await formPage("forms/lever-shieldai").fill();
    expect(result.left).toContain("Are you authorized to work in the United States?");
    expect(result.left).toContain("Will you require sponsorship for employment now or in the future?");
    expect(result.left).not.toContain("Yes");
    expect(result.left).not.toContain("Full name");
  });
});

describe("fillForm keeps what's already there", () => {
  it("doesn't overwrite a field the user filled", async () => {
    const page = formPage("forms/lever-zoox", {
      edit: (html) => html.replace('name="email"', 'name="email" value="mine@example.com"'),
    });
    const result = await page.fill();
    expect(page.document.querySelector("input[name=email]").value).toBe("mine@example.com");
    expect(fields(result.kept)).toEqual(["email"]);
    expect(fields(result.filled)).not.toContain("email");
  });

  it("fills nothing the second time", async () => {
    const page = formPage("forms/greenhouse-figma");
    await page.fill();
    const second = await page.fill();
    expect(second.filled).toEqual([]);
    expect(fields(second.kept)).toEqual(["firstName", "lastName", "email", "phone", "linkedin", "resume"]);
    expect(page.document.querySelector("#resume").files).toHaveLength(1);
  });

  it("skips profile fields the user left blank, and the file when there's no resume", async () => {
    const page = formPage("forms/lever-spotify");
    const result = await page.fill({ firstName: "Ada", email: "ada@example.com" }, null);
    expect(fields(result.filled)).toEqual(["fullName", "email"]);
    expect(page.document.querySelector("input[name=name]").value).toBe("Ada");
    expect(page.document.querySelector("input[name=resume]").files).toHaveLength(0);
  });
});

describe("fillForm reports what the page did with the values", () => {
  it("counts a field the page cleared as rejected, not filled", async () => {
    const page = formPage("forms/greenhouse-discord");
    // What a controlled input that ignores our events looks like
    page.document.querySelector("#email").addEventListener("input", (event) => { event.target.value = ""; });
    const result = await page.fill();
    expect(fields(result.rejected)).toEqual(["email"]);
    expect(fields(result.filled)).not.toContain("email");
    expect(page.document.querySelector("#email").hasAttribute("data-openapply-filled")).toBe(false);
  });

  it("accepts a phone number the page reformatted", async () => {
    const page = formPage("forms/greenhouse-discord");
    page.document.querySelector("#phone").addEventListener("change", (event) => { event.target.value = "+1 415-555-0100"; });
    const result = await page.fill();
    expect(fields(result.filled)).toContain("phone");
  });
});

describe("fillForm finds label-only fields carefully", () => {
  const greenhouse = (html) => formPage("forms/greenhouse-gitlab", { edit: html });

  it("leaves a question that only mentions the field", async () => {
    const page = greenhouse((html) => html.replace(">LinkedIn Profile<", ">LinkedIn Profile or a short bio<"));
    const result = await page.fill();
    expect(fields(result.filled)).not.toContain("linkedin");
    expect(page.document.querySelector("#question_36622854002").value).toBe("");
  });

  it("leaves both fields when two share a label", async () => {
    const page = greenhouse((html) => html.replace(
      ">What's the name you'd prefer us to use throughout the interview process?<",
      ">LinkedIn Profile<",
    ));
    const result = await page.fill();
    expect(fields(result.filled)).not.toContain("linkedin");
  });

  it("ignores the label's star, '(optional)' and a trailing colon", async () => {
    const page = greenhouse((html) => html.replace(">LinkedIn Profile<", ">LinkedIn URL (optional):<"));
    const result = await page.fill();
    expect(fields(result.filled)).toContain("linkedin");
  });
});

describe("fillForm on pages it can't fill", () => {
  it("does nothing outside the three ATSs", async () => {
    const page = formPage("forms/lever-spotify", { url: "https://careers.example.com/apply" });
    const before = snapshot(page.document);
    const result = await page.fill();
    expect(result).toMatchObject({ ats: null, formFound: false, filled: [] });
    expect(snapshot(page.document)).toEqual(before);
  });

  it("says when the ATS page has no form yet (a Lever posting before Apply)", async () => {
    const result = await formPage("lever", { url: "https://jobs.lever.co/spotify/2193db3f-77c5-43b8-b030-8f92c9882bf1" }).fill();
    expect(result).toMatchObject({ ats: "lever", formFound: false, filled: [] });
  });

  it("points at a form embedded from another site", async () => {
    const src = "https://job-boards.greenhouse.io/embed/job_app?for=stripe&token=8172510";
    const page = formPage(null, {
      url: "https://careers.example.com/jobs/123",
      html: `<main><h1>Engineer</h1><div id="grnhse_app"><iframe id="grnhse_iframe" src="${src}"></iframe></div></main>`,
    });
    const result = await page.fill();
    expect(result).toMatchObject({ ats: null, formFound: false, embeddedForm: src });
  });
});
