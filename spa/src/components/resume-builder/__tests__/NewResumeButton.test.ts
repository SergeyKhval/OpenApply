import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";

const flag = ref(false);
const pending = ref(false);
const resumes = Object.assign(ref<unknown[]>([]), { pending });
const push = vi.fn();
const createBuiltResume = vi.fn(async (..._args: unknown[]) => "new-1");
const trackEvent = vi.fn();

vi.mock("vuefire", () => ({ useCurrentUser: () => ref({ uid: "user-1", displayName: "Sarah Chen", email: "sarah@example.com" }) }));
vi.mock("vue-router", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/composables/useFeatureFlag", () => ({ useFeatureFlag: () => flag }));
vi.mock("@/composables/useResumes", () => ({ useResumes: () => resumes }));
vi.mock("@/composables/useBuiltResume", () => ({ createBuiltResume: (...args: unknown[]) => createBuiltResume(...args) }));
vi.mock("@/analytics", () => ({ trackEvent: (...args: unknown[]) => trackEvent(...args) }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import NewResumeButton from "../NewResumeButton.vue";

enableAutoUnmount(afterEach);

describe("NewResumeButton", () => {
  beforeEach(() => {
    flag.value = false;
    pending.value = false;
    resumes.value = [];
    push.mockClear();
    trackEvent.mockClear();
  });

  it("is hidden, and offers nothing, while the flag is off", () => {
    const wrapper = mount(NewResumeButton, { props: { surface: "documents_header" } });
    expect(wrapper.find("button").exists()).toBe(false);
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it("counts one offer when it shows", async () => {
    resumes.value = [{ id: "r1" }];
    flag.value = true;
    const wrapper = mount(NewResumeButton, { props: { surface: "documents_header" } });
    resumes.value = [{ id: "r1" }, { id: "r2" }];
    await flushPromises();
    expect(wrapper.find("button").exists()).toBe(true);
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith("resume_builder_offered", { surface: "documents_header", hadResume: true });
  });

  it("waits for the resumes to load before counting the offer", async () => {
    flag.value = true;
    pending.value = true;
    mount(NewResumeButton, { props: { surface: "documents_header" } });
    await flushPromises();
    expect(trackEvent).not.toHaveBeenCalled();
    resumes.value = [{ id: "r1" }];
    pending.value = false;
    await flushPromises();
    expect(trackEvent).toHaveBeenCalledWith("resume_builder_offered", { surface: "documents_header", hadResume: true });
  });

  it("creates a resume from the account and opens the editor", async () => {
    flag.value = true;
    const wrapper = mount(NewResumeButton, { props: { surface: "documents_header" } });
    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(createBuiltResume).toHaveBeenCalledWith("user-1", { name: "Sarah Chen", email: "sarah@example.com" });
    expect(push).toHaveBeenCalledWith({ name: "/documents/resumes/[resumeId]", params: { resumeId: "new-1" } });
  });
});
