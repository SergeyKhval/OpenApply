import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockTrackEvent = vi.fn();
vi.mock("@/analytics", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

import FollowUpDialog from "../FollowUpDialog.vue";

const job = { id: "job-1", companyName: "Acme", position: "Engineer", appliedAt: null } as unknown as InstanceType<
  typeof FollowUpDialog
>["$props"]["job"];

// The real DialogContent teleports via reka-ui's DialogPortal; render it in
// place instead, the same way the JobReportSection test stubs Dialog.
const mountDialog = () =>
  mount(FollowUpDialog, {
    props: { job },
    global: { stubs: { DialogContent: { template: "<div><slot /></div>" } } },
  });

describe("FollowUpDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("tracks follow_up_copied with the application id after a successful copy", async () => {
    const wrapper = mountDialog();

    await wrapper.findAll("button").find((b) => b.text().includes("Copy message"))?.trigger("click");
    await flushPromises();

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    expect(mockTrackEvent).toHaveBeenCalledWith("follow_up_copied", { applicationId: "job-1" });
    expect(wrapper.text()).toContain("Copied");
  });

  it("does not track follow_up_copied when the clipboard write fails", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    const wrapper = mountDialog();

    await wrapper.findAll("button").find((b) => b.text().includes("Copy message"))?.trigger("click");
    await flushPromises();

    expect(mockTrackEvent).not.toHaveBeenCalled();
  });
});
