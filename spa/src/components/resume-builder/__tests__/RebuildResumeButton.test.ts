import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";

const flag = ref(false);
const push = vi.fn();
const toast = vi.fn();
const trackEvent = vi.fn();
const importResume = vi.fn(async (..._args: unknown[]) => "built-1");

vi.mock("vue-router", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/composables/useFeatureFlag", () => ({ useFeatureFlag: () => flag }));
vi.mock("@/composables/useResumeImport", () => ({ importResume: (...args: unknown[]) => importResume(...args) }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/analytics", () => ({ trackEvent: (...args: unknown[]) => trackEvent(...args) }));

import RebuildResumeButton from "../RebuildResumeButton.vue";
import type { Resume } from "@/types";

enableAutoUnmount(afterEach);

const upload = { id: "u1", fileName: "sarah.pdf", status: "parsed" };
const mountButton = (resume: Record<string, unknown> = upload) =>
  mount(RebuildResumeButton, { props: { resume: resume as unknown as Resume, surface: "resume_menu" }, slots: { default: "Edit as a new resume" } });

describe("RebuildResumeButton", () => {
  beforeEach(() => {
    flag.value = true;
    push.mockClear();
    toast.mockClear();
    trackEvent.mockClear();
    importResume.mockReset();
    importResume.mockResolvedValue("built-1");
  });

  it("is hidden, and offers nothing, while the flag is off", () => {
    flag.value = false;
    expect(mountButton().find("button").exists()).toBe(false);
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it("isn't offered for a built resume or a PDF we couldn't read", () => {
    expect(mountButton({ id: "b1", kind: "built", status: "parsed" }).find("button").exists()).toBe(false);
    expect(mountButton({ id: "u2", fileName: "x.pdf", status: "parse-failed" }).find("button").exists()).toBe(false);
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it("counts the offer, then copies the PDF into a new resume and opens it", async () => {
    const wrapper = mountButton();
    expect(trackEvent).toHaveBeenCalledWith("resume_builder_offered", { surface: "resume_menu", hadResume: true });
    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(importResume).toHaveBeenCalledWith({ source: "resume", resumeId: "u1" });
    expect(push).toHaveBeenCalledWith({ name: "/documents/resumes/[resumeId]", params: { resumeId: "built-1" } });
  });

  it("says why when the copy fails", async () => {
    importResume.mockRejectedValue(new Error("We couldn't read the text in this PDF, so there's nothing to copy."));
    const wrapper = mountButton();
    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: "We couldn't read the text in this PDF, so there's nothing to copy." }));
    expect(push).not.toHaveBeenCalled();
  });
});
