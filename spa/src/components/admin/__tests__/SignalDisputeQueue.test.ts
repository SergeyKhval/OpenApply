import { describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("@/firebase/config", () => ({ functions: {} }));
vi.mock("firebase/functions", () => ({ httpsCallable: (_: unknown, name: string) => (data?: unknown) => call(name, data) }));

import SignalDisputeQueue from "../SignalDisputeQueue.vue";

const dispute = {
  id: "d1",
  keyHash: "a".repeat(64),
  contactEmail: "hr@acme.com",
  message: "The role is open.",
  createdAt: new Date(Date.now() - 8 * 86400000).toISOString(),
  link: "https://jobs.lever.co/acme/1",
  companyTitle: "acme|analyst",
  signals: {
    signs: { firstSeenAt: "2026-01-01", openApplication: true },
    reports: { no_reply_30d: { days: [0, 1, 2].map((ago) => new Date(Date.now() - ago * 86400000).toISOString().slice(0, 10)) } },
    reportsHidden: true,
    hidden: false,
  },
};

describe("SignalDisputeQueue", () => {
  it("lists open requests with what the posting shows, reports included", async () => {
    call.mockResolvedValueOnce({ data: { disputes: [dispute] } });
    const wrapper = mount(SignalDisputeQueue);
    await flushPromises();
    const text = wrapper.text();
    expect(text).toContain("1 open");
    expect(text).toContain("The role is open.");
    expect(text).toContain("8 days ago · overdue");
    expect(text).toContain("(reports hidden during review)");
    expect(text).toContain("3 people reported no reply 30+ days after applying");
    expect(text).toContain("Open application, not a specific opening");
  });

  it("resolves through the callable and drops the request from the list", async () => {
    call.mockResolvedValueOnce({ data: { disputes: [dispute] } }).mockResolvedValueOnce({ data: { resolved: true } });
    const wrapper = mount(SignalDisputeQueue);
    await flushPromises();
    await wrapper.find("textarea").setValue("Checked with the employer");
    await wrapper.findAll("button").find((button) => button.text() === "Keep reports")!.trigger("click");
    await flushPromises();
    expect(call).toHaveBeenLastCalledWith("resolveSignalDispute", { disputeId: "d1", action: "keep", note: "Checked with the employer" });
    expect(wrapper.text()).toContain("0 open");
  });
});
