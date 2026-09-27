import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";

const resumes = ref<unknown[]>([]);
const push = vi.fn();
const createBuiltResume = vi.fn(async (..._args: unknown[]) => "scratch-1");
const importResume = vi.fn(async (..._args: unknown[]) => "imported-1");

vi.mock("vuefire", () => ({ useCurrentUser: () => ref({ uid: "user-1", displayName: "Sarah Chen", email: "sarah@example.com" }) }));
vi.mock("vue-router", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/composables/useResumes", () => ({ useResumes: () => resumes }));
vi.mock("@/composables/useBuiltResume", () => ({ createBuiltResume: (...args: unknown[]) => createBuiltResume(...args) }));
vi.mock("@/composables/useResumeImport", () => ({ importResume: (...args: unknown[]) => importResume(...args) }));
vi.mock("@/components/ai/AiSheet.vue", () => ({
  default: defineComponent({ props: ["open", "title"], setup: (_props, { slots }) => () => h("div", slots.default?.()) }),
}));

import NewResumeSheet from "../NewResumeSheet.vue";

enableAutoUnmount(afterEach);

const mountSheet = () => mount(NewResumeSheet, { props: { open: true }, attachTo: document.body });
const button = (wrapper: ReturnType<typeof mountSheet>, text: string) => wrapper.findAll("button").find((candidate) => candidate.text().includes(text))!;

describe("NewResumeSheet", () => {
  beforeEach(() => {
    resumes.value = [];
    push.mockClear();
    createBuiltResume.mockClear();
    importResume.mockReset();
    importResume.mockResolvedValue("imported-1");
  });

  it("starts from scratch with the account's name and email", async () => {
    const wrapper = mountSheet();
    await button(wrapper, "Start from scratch").trigger("click");
    await flushPromises();
    expect(createBuiltResume).toHaveBeenCalledWith("user-1", { name: "Sarah Chen", email: "sarah@example.com" });
    expect(push).toHaveBeenCalledWith({ name: "/documents/resumes/[resumeId]", params: { resumeId: "scratch-1" } });
  });

  it("offers each uploaded PDF that was read, not built ones", async () => {
    resumes.value = [
      { id: "u1", fileName: "sarah.pdf", status: "parsed" },
      { id: "u2", fileName: "broken.pdf", status: "parse-failed" },
      { id: "b1", kind: "built", title: "Built", status: "parsed" },
    ];
    const wrapper = mountSheet();
    expect(wrapper.text()).toContain("sarah.pdf");
    expect(wrapper.text()).not.toContain("broken.pdf");
    expect(wrapper.text()).not.toContain("Built");
    await button(wrapper, "sarah.pdf").trigger("click");
    await flushPromises();
    expect(importResume).toHaveBeenCalledWith({ source: "resume", resumeId: "u1" });
    expect(push).toHaveBeenCalledWith({ name: "/documents/resumes/[resumeId]", params: { resumeId: "imported-1" } });
  });

  it("imports pasted profile text", async () => {
    const wrapper = mountSheet();
    await button(wrapper, "Paste your profile").trigger("click");
    await flushPromises();
    await wrapper.get("textarea").setValue("Sarah Chen\nSenior Frontend Engineer at Globex");
    await button(wrapper, "Import my profile").trigger("click");
    await flushPromises();
    expect(importResume).toHaveBeenCalledWith({ source: "linkedin_paste", text: "Sarah Chen\nSenior Frontend Engineer at Globex" });
  });

  it("shows why an import failed and stays open", async () => {
    importResume.mockRejectedValue(new Error("There's too little text here to build a resume from."));
    resumes.value = [{ id: "u1", fileName: "sarah.pdf", status: "parsed" }];
    const wrapper = mountSheet();
    await button(wrapper, "sarah.pdf").trigger("click");
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe("There's too little text here to build a resume from.");
    expect(push).not.toHaveBeenCalled();
  });

  it("turns down a file that isn't a PDF before sending it", async () => {
    const wrapper = mountSheet();
    await button(wrapper, "Upload LinkedIn PDF").trigger("click");
    const input = wrapper.get('input[type="file"]');
    Object.defineProperty(input.element, "files", { value: [new File(["x"], "profile.docx", { type: "application/msword" })] });
    await input.trigger("change");
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe("That file isn't a PDF.");
    expect(importResume).not.toHaveBeenCalled();
  });
});
