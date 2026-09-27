import { afterEach, describe, expect, it } from "vitest";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { computed, defineComponent, h, ref } from "vue";
import FlaggedHint from "../FlaggedHint.vue";
import ImportNotice from "../ImportNotice.vue";
import { FLAGGED_FIELDS } from "@/lib/resumeImport";
import type { StructuredResume } from "@/lib/builtResume";
import type { BuiltResume } from "@/types";

enableAutoUnmount(afterEach);

describe("FlaggedHint", () => {
  const mountHint = (flagged: string[], path: string, value: unknown) =>
    mount(
      defineComponent({
        setup: () => () => h(FlaggedHint, { path, value }),
      }),
      { global: { provide: { [FLAGGED_FIELDS as symbol]: computed(() => new Set(flagged)) } } },
    );

  it("asks to check a flagged field that's still empty", () => {
    expect(mountHint(["contact.email"], "contact.email", "").text()).toBe("Check this, we couldn't read it clearly.");
  });

  it("says nothing once it's filled in, or when nothing was flagged", () => {
    expect(mountHint(["contact.email"], "contact.email", "sarah@example.com").text()).toBe("");
    expect(mountHint([], "contact.email", "").text()).toBe("");
  });

  it("says nothing outside an import", () => {
    expect(mount(FlaggedHint, { props: { path: "contact.email", value: "" } }).text()).toBe("");
  });
});

describe("ImportNotice", () => {
  const structured = (): StructuredResume => ({
    version: 1,
    contact: { name: "Sarah Chen", headline: "", email: "", phone: "", location: "", links: [] },
    sections: [
      {
        id: "s1",
        type: "experience",
        heading: "Experience",
        entries: [{ id: "e1", title: "Engineer", organization: "Globex", location: "", start: null, end: null, bullets: [] }],
      },
    ],
  });

  function mountNotice(importedFrom: NonNullable<BuiltResume["importedFrom"]>) {
    const resume = ref(structured());
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(ImportNotice, { importedFrom, modelValue: resume.value, "onUpdate:modelValue": (value: StructuredResume) => (resume.value = value) }),
      }),
    );
    return { wrapper, resume };
  }

  it("says nothing was reworded", () => {
    const { wrapper } = mountNotice({ source: "resume", flaggedFields: [] });
    expect(wrapper.text()).toContain("We copied your resume's text as is. Nothing was reworded.");
  });

  it("asks to check every job's header after an import without the model", () => {
    const { wrapper } = mountNotice({ source: "resume", flaggedFields: ["sections.s1.entries.e1.title"], fallback: true });
    expect(wrapper.text()).toContain("We couldn't sort this one automatically");
    expect(wrapper.text()).not.toContain("left empty");
  });

  it("lets the user place an unsorted line under a job, then drops it from the list", async () => {
    const { wrapper, resume } = mountNotice({ source: "linkedin_pdf", flaggedFields: [], unsorted: ["• Shipped the app"] });
    expect(wrapper.text()).toContain("Shipped the app");
    await wrapper.get('select[aria-label="Put “Shipped the app” under"]').setValue("s1/e1");
    const section = resume.value.sections[0]!;
    expect("entries" in section && section.entries[0]!.bullets.map((bullet) => bullet.text)).toEqual(["Shipped the app"]);
    expect(wrapper.text()).not.toContain("Lines to place");
  });

  it("lists the lines it didn't import, collapsed", () => {
    const { wrapper } = mountNotice({ source: "linkedin_paste", flaggedFields: [], notImported: ["Show all 12 skills", "500+ connections"] });
    const details = wrapper.get("details");
    expect(details.attributes("open")).toBeUndefined();
    expect(details.text()).toContain("2 lines we didn't import");
    expect(details.text()).toContain("500+ connections");
  });
});
