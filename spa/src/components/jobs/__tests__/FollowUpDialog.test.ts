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
const mountDialog = (props: Record<string, unknown> = {}) =>
  mount(FollowUpDialog, {
    props: { job, ...props },
    global: { stubs: { DialogContent: { template: "<div><slot /></div>" } } },
  });

const clickCopy = async (wrapper: ReturnType<typeof mountDialog>) => {
  await wrapper.findAll("button").find((b) => b.text().includes("Copy message"))?.trigger("click");
  await flushPromises();
};

describe("FollowUpDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("tracks follow_up_copied with the application id and follow_up template after a successful copy", async () => {
    const wrapper = mountDialog();

    await clickCopy(wrapper);

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    expect(mockTrackEvent).toHaveBeenCalledWith("follow_up_copied", { applicationId: "job-1", template: "follow_up" });
    expect(wrapper.text()).toContain("Copied");
  });

  it("does not track follow_up_copied when the clipboard write fails", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    const wrapper = mountDialog();

    await clickCopy(wrapper);

    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it("defaults to the follow-up template when no type prop is given", () => {
    const wrapper = mountDialog();

    expect(wrapper.text()).toContain("Follow up with Acme");
    expect((wrapper.find("textarea").element as HTMLTextAreaElement).value).toContain(
      "I applied for the Engineer role at Acme",
    );
  });

  it("shows a thank-you template addressed to the contact when type is thank_you", () => {
    const wrapper = mountDialog({ type: "thank_you", contactName: "Priya" });

    expect(wrapper.text()).toContain("Thank Acme for the interview");
    const message = (wrapper.find("textarea").element as HTMLTextAreaElement).value;
    expect(message).toContain("Hi Priya,");
    expect(message).toContain("Engineer role at Acme");
  });

  it("falls back to a generic greeting in the thank-you template when there is no contact name", () => {
    const wrapper = mountDialog({ type: "thank_you" });

    const message = (wrapper.find("textarea").element as HTMLTextAreaElement).value;
    expect(message).toContain("Hi,");
  });

  it("shows an offer-response template asking for time to decide when type is offer_response", () => {
    const wrapper = mountDialog({ type: "offer_response", contactName: "Priya" });

    expect(wrapper.text()).toContain("Respond to the offer from Acme");
    const message = (wrapper.find("textarea").element as HTMLTextAreaElement).value;
    expect(message).toContain("Hi Priya,");
    expect(message).toContain("offer for the Engineer role at Acme");
  });

  it("tracks follow_up_copied with the thank_you template type on copy", async () => {
    const wrapper = mountDialog({ type: "thank_you" });

    await clickCopy(wrapper);

    expect(mockTrackEvent).toHaveBeenCalledWith("follow_up_copied", { applicationId: "job-1", template: "thank_you" });
  });

  it("tracks follow_up_copied with the offer_response template type on copy", async () => {
    const wrapper = mountDialog({ type: "offer_response" });

    await clickCopy(wrapper);

    expect(mockTrackEvent).toHaveBeenCalledWith("follow_up_copied", { applicationId: "job-1", template: "offer_response" });
  });
});
