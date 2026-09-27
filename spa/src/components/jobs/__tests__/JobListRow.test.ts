import { afterEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, flushPromises, mount, RouterLinkStub } from "@vue/test-utils";
import type { JobApplication } from "@/types";

const markApplied = vi.fn();
const moveToStage = vi.fn();
vi.mock("@/composables/useUpdateJobApplicationStatus", () => ({
  useUpdateJobApplicationStatus: () => ({ markApplied, moveToStage, updateJobApplicationStatus: vi.fn() }),
}));
vi.mock("@/composables/useJobSignals", async () => {
  const { ref } = await import("vue");
  return { useJobSignals: () => ref([]) };
});

import JobListRow from "../JobListRow.vue";

enableAutoUnmount(afterEach);

const NOW = new Date(2026, 8, 25, 10);
const job = (overrides: Partial<JobApplication> = {}) =>
  ({
    id: "j1",
    companyName: "Brightline Health",
    position: "Frontend Engineer",
    status: "applied",
    createdAt: { toDate: () => new Date(2026, 8, 10) },
    appliedAt: { toDate: () => new Date(2026, 8, 17) },
    ...overrides,
  }) as unknown as JobApplication;

const mountRow = (overrides: Partial<JobApplication> = {}) =>
  mount(JobListRow, {
    props: { job: job(overrides), now: NOW },
    global: { stubs: { RouterLink: RouterLinkStub } },
    attachTo: document.body,
  });

describe("JobListRow", () => {
  it("shows the stage as a pill that opens the stage menu", async () => {
    const wrapper = mountRow();
    const pill = wrapper.get('button[aria-label="Applied. Move Brightline Health"]');
    expect(pill.text()).toBe("Applied");
    await pill.trigger("keydown", { key: "Enter" });
    await flushPromises();
    const items = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    items.find((item) => item.textContent?.trim() === "Interviewing")!.click();
    await flushPromises();
    expect(moveToStage).toHaveBeenCalledWith(expect.objectContaining({ id: "j1" }), "interviewing");
  });

  it("saved jobs get I applied instead of the pill", async () => {
    const wrapper = mountRow({ status: "draft" });
    expect(wrapper.find('button[aria-label^="Saved"]').exists()).toBe(false);
    await wrapper.get("button").trigger("click");
    expect(markApplied).toHaveBeenCalledWith("j1");
  });

  it("says when it moved and flags a follow-up that's due", () => {
    const wrapper = mountRow({ followUpAt: { toDate: () => new Date(2026, 8, 24) } } as Partial<JobApplication>);
    expect(wrapper.text()).toContain("Applied 8 days ago");
    expect(wrapper.text()).toContain("Follow up today");
  });

  it("without a follow-up, adds the match or the salary", () => {
    expect(mountRow({ salary: "€85k" }).text()).toContain("· €85k");
    expect(
      mountRow({ toolMatch: { matchScore: 71 } } as unknown as Partial<JobApplication>).text(),
    ).toContain("· Match 71");
  });

  it("the whole row opens the job", () => {
    expect(mountRow().getComponent(RouterLinkStub).props("to")).toBe("/jobs/j1");
  });
});
