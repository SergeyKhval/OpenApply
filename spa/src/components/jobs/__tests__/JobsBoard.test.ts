import { describe, expect, it, vi } from "vitest";
import { mount, RouterLinkStub } from "@vue/test-utils";
import type { JobApplication, JobStatus } from "@/types";

const markApplied = vi.fn();
const updateJobApplicationStatus = vi.fn();
vi.mock("@/composables/useUpdateJobApplicationStatus", () => ({
  useUpdateJobApplicationStatus: () => ({ markApplied, updateJobApplicationStatus }),
}));

import JobsBoard from "../JobsBoard.vue";

const NOW = new Date(2026, 8, 25, 10);
const job = (id: string, status: JobStatus) =>
  ({
    id,
    companyName: `Company ${id}`,
    position: "Engineer",
    status,
    createdAt: { toDate: () => new Date(2026, 8, 20) },
  }) as unknown as JobApplication;

const mountBoard = (jobs: JobApplication[]) =>
  mount(JobsBoard, {
    props: { jobs, now: NOW },
    global: { stubs: { RouterLink: RouterLinkStub, JobStageMenu: true } },
  });

describe("JobsBoard", () => {
  it("puts each job in its stage lane and every closed status under Closed", () => {
    const wrapper = mountBoard([
      job("s", "draft"),
      job("a", "applied"),
      job("i", "interviewing"),
      job("o", "offered"),
      job("h", "hired"),
      job("r", "rejected"),
      job("w", "withdrew"),
      job("x", "archived"),
    ]);
    const lane = (name: string) => wrapper.find(`section[aria-label="${name}"]`);
    expect(lane("Saved").text()).toContain("Company s");
    expect(lane("Applied").text()).toContain("Company a");
    expect(lane("Interviewing").text()).toContain("Company i");
    expect(lane("Offer").text()).toContain("Company o");
    const closed = lane("Closed").text();
    for (const reason of ["Hired · 1", "Rejected · 1", "Withdrew · 1", "Archived · 1"]) {
      expect(closed).toContain(reason);
    }
  });

  it("I applied on a saved job sets the follow-up (markApplied)", async () => {
    const wrapper = mountBoard([job("s", "draft")]);
    await wrapper.find("button").trigger("click");
    expect(markApplied).toHaveBeenCalledWith("s");
  });

  it("shows a hint in empty lanes", () => {
    const wrapper = mountBoard([]);
    expect(wrapper.find('section[aria-label="Offer"]').text()).toContain("No offers yet.");
  });
});
