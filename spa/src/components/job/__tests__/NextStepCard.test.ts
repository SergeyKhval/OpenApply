import { afterEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import type { TimelineEntry } from "@/lib/timeline";
import type { JobApplication } from "@/types";

vi.mock("@/composables/useUpdateJobApplicationStatus", () => ({
  useUpdateJobApplicationStatus: () => ({
    markApplied: vi.fn(),
    scheduleFollowUp: vi.fn(),
    snoozeFollowUp: vi.fn(),
    clearFollowUp: vi.fn(),
  }),
}));

import NextStepCard from "../NextStepCard.vue";

enableAutoUnmount(afterEach);

const NOW = new Date(2026, 8, 27, 9);
const job = { id: "j1", companyName: "Northwind Labs", status: "interviewing" } as unknown as JobApplication;
const interview = {
  kind: "interview",
  id: "i1",
  date: new Date(2026, 8, 29, 10),
  title: "Tech screen with Dana Ruiz",
  interview: { status: "pending" },
  upcoming: true,
} as unknown as Extract<TimelineEntry, { kind: "interview" }>;

const mountCard = () =>
  mount(NextStepCard, { props: { job, upcomingInterview: interview, now: NOW }, attachTo: document.body });

describe("NextStepCard with an upcoming interview", () => {
  it("says when, relative to today", () => {
    const wrapper = mountCard();
    expect(wrapper.text()).toContain("Tech screen with Dana Ruiz");
    expect(wrapper.text()).toContain("in 2 days");
  });

  it("offers Edit step and Mark done, as on the canvas", () => {
    const wrapper = mountCard();
    expect(wrapper.findAll("button").map((button) => button.text())).toEqual(["Edit step", "Mark done"]);
  });

  it("Edit step asks the page to open the interview", async () => {
    const wrapper = mountCard();
    await wrapper.findAll("button")[0].trigger("click");
    expect(wrapper.emitted("edit-interview")).toHaveLength(1);
  });

  it("Mark done asks passed or not and passes the answer on", async () => {
    const wrapper = mountCard();
    await wrapper.findAll("button")[1].trigger("keydown", { key: "Enter" });
    await flushPromises();
    const items = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    expect(items.map((item) => item.textContent?.trim())).toEqual(["Passed", "Didn't pass"]);
    items[1].click();
    await flushPromises();
    expect(wrapper.emitted("interview-status")).toEqual([["failed"]]);
  });
});
