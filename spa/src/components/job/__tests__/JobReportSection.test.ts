import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import type { JobApplication } from "@/types";

const { ownReport, call } = vi.hoisted(() => ({ ownReport: { value: null as unknown }, call: vi.fn() }));
vi.mock("vuefire", async () => {
  const { ref: vueRef } = await import("vue");
  return {
    useCurrentUser: () => vueRef({ uid: "u1" }),
    useDocument: () => ({ data: vueRef(ownReport.value) }),
  };
});
vi.mock("@/firebase/config", () => ({ db: {}, functions: {} }));
vi.mock("firebase/firestore", () => ({ doc: () => ({}) }));
vi.mock("firebase/functions", () => ({ httpsCallable: (_: unknown, name: string) => (data: unknown) => call(name, data) }));
vi.mock("@/analytics", () => ({ trackEvent: vi.fn() }));

import JobReportSection from "../JobReportSection.vue";

const NOW = new Date(2026, 8, 26, 12);
const job = (status: string, appliedDaysAgo: number) =>
  ({
    id: "app-1",
    status,
    jobKeyHash: "a".repeat(64),
    appliedAt: new Date(NOW.getTime() - appliedDaysAgo * 86400000),
    createdAt: new Date(2026, 0, 1),
  }) as unknown as JobApplication;

const mountSection = (application: JobApplication) =>
  mount(JobReportSection, { props: { job: application, now: NOW }, global: { stubs: { Dialog: true } } });

describe("JobReportSection", () => {
  beforeEach(() => {
    ownReport.value = null;
    call.mockReset();
  });

  it("asks to share no reply after 30 days in applied, and sends it", async () => {
    const wrapper = mountSection(job("applied", 31));
    expect(wrapper.text()).toContain("No reply for 30+ days?");
    await wrapper.findAll("button").find((button) => button.text() === "Share no reply")!.trigger("click");
    expect(call).toHaveBeenCalledWith("reportJob", { applicationId: "app-1", reason: "no_reply_30d" });
  });

  it("doesn't ask before 30 days or after the status moved on", () => {
    expect(mountSection(job("applied", 20)).text()).not.toContain("No reply for 30+ days?");
    expect(mountSection(job("interviewing", 60)).text()).not.toContain("No reply for 30+ days?");
    expect(mountSection(job("applied", 20)).text()).toContain("Report this posting");
  });

  it("shows the person's own report with a way to withdraw it", async () => {
    ownReport.value = { reason: "filled_still_listed", status: "active" };
    const wrapper = mountSection(job("applied", 60));
    expect(wrapper.text()).toContain("You reported: Told the role was filled or on hold, still listed");
    expect(wrapper.text()).not.toContain("Report this posting");
    await wrapper.findAll("button").find((button) => button.text() === "Withdraw")!.trigger("click");
    expect(call).toHaveBeenCalledWith("withdrawJobReport", { keyHash: "a".repeat(64) });
  });
});
