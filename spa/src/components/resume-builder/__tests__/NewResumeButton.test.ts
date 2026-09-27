import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { defineComponent, ref } from "vue";

const pending = ref(false);
const resumes = Object.assign(ref<unknown[]>([]), { pending });
const trackEvent = vi.fn();

vi.mock("@/composables/useResumes", () => ({ useResumes: () => resumes }));
vi.mock("../NewResumeSheet.vue", () => ({ default: defineComponent({ name: "NewResumeSheet", props: ["open"], setup: () => () => null }) }));
vi.mock("@/analytics", () => ({ trackEvent: (...args: unknown[]) => trackEvent(...args) }));

import NewResumeButton from "../NewResumeButton.vue";

enableAutoUnmount(afterEach);

describe("NewResumeButton", () => {
  beforeEach(() => {
    pending.value = false;
    resumes.value = [];
    trackEvent.mockClear();
  });

  it("counts one offer when it shows", async () => {
    resumes.value = [{ id: "r1" }];
    const wrapper = mount(NewResumeButton, { props: { surface: "documents_header" } });
    resumes.value = [{ id: "r1" }, { id: "r2" }];
    await flushPromises();
    expect(wrapper.find("button").exists()).toBe(true);
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith("resume_builder_offered", { surface: "documents_header", hadResume: true });
  });

  it("waits for the resumes to load before counting the offer", async () => {
    pending.value = true;
    mount(NewResumeButton, { props: { surface: "documents_header" } });
    await flushPromises();
    expect(trackEvent).not.toHaveBeenCalled();
    resumes.value = [{ id: "r1" }];
    pending.value = false;
    await flushPromises();
    expect(trackEvent).toHaveBeenCalledWith("resume_builder_offered", { surface: "documents_header", hadResume: true });
  });

  it("puts class and aria-label on the button", () => {
    const wrapper = mount(NewResumeButton, { props: { surface: "documents_header" }, attrs: { class: "round", "aria-label": "New resume" } });
    expect(wrapper.get("button").classes()).toContain("round");
    expect(wrapper.get("button").attributes("aria-label")).toBe("New resume");
  });

  it("takes its own label and counts the offer for its surface", async () => {
    const wrapper = mount(NewResumeButton, { props: { surface: "resumes_empty", variant: "outline" }, slots: { default: "Build one here" } });
    await flushPromises();
    expect(wrapper.get("button").text()).toBe("Build one here");
    expect(trackEvent).toHaveBeenCalledWith("resume_builder_offered", { surface: "resumes_empty", hadResume: false });
  });

  it("opens the chooser", async () => {
    const wrapper = mount(NewResumeButton, { props: { surface: "documents_header" } });
    expect(wrapper.findComponent({ name: "NewResumeSheet" }).props("open")).toBe(false);
    await wrapper.get("button").trigger("click");
    expect(wrapper.findComponent({ name: "NewResumeSheet" }).props("open")).toBe(true);
  });
});
