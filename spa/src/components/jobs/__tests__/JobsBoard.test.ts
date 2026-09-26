import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mount, RouterLinkStub } from "@vue/test-utils";
import type { JobApplication, JobStatus } from "@/types";
import type { OpenStage } from "@/lib/stages";
import { statusForStage } from "@/lib/stages";

const markApplied = vi.fn();
const updateJobApplicationStatus = vi.fn();
const moveToStage = vi.fn((job: { id: string; status: JobStatus }, stage: OpenStage) => {
  if (stage === "applied" && job.status === "draft") return markApplied(job.id);
  return updateJobApplicationStatus(job.id, statusForStage(stage));
});
vi.mock("@/composables/useUpdateJobApplicationStatus", () => ({
  useUpdateJobApplicationStatus: () => ({ markApplied, updateJobApplicationStatus, moveToStage }),
}));

vi.mock("@/composables/useJobSignals", async () => {
  const { ref } = await import("vue");
  return { useJobSignals: () => ref([]) };
});

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

let mounted: ReturnType<typeof mount> | undefined;

const mountBoard = (jobs: JobApplication[]) => {
  mounted = mount(JobsBoard, {
    props: { jobs, now: NOW },
    global: { stubs: { RouterLink: RouterLinkStub, JobStageMenu: true } },
    attachTo: document.body,
  });
  return mounted;
};

const dataTransferStub = () => ({ setData: vi.fn(), getData: vi.fn(), dropEffect: "", effectAllowed: "" });

const dragCardTo = async (wrapper: ReturnType<typeof mount>, jobId: string, laneLabel: string) => {
  await wrapper.find(`[data-job-id="${jobId}"]`).trigger("dragstart", { dataTransfer: dataTransferStub() });
  const lane = wrapper.find(`section[aria-label="${laneLabel}"]`);
  await lane.trigger("dragover", { dataTransfer: dataTransferStub() });
  await lane.trigger("drop", { dataTransfer: dataTransferStub() });
};

describe("JobsBoard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = undefined;
  });

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

  describe("drag and drop", () => {
    it("dropping a card on another open lane moves it through the shared stage-change path", async () => {
      const wrapper = mountBoard([job("a", "applied")]);
      await dragCardTo(wrapper, "a", "Interviewing");
      expect(moveToStage).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }), "interviewing");
      expect(updateJobApplicationStatus).toHaveBeenCalledWith("a", "interviewing");
    });

    it("dropping a saved (draft) card on Applied goes through markApplied, same as the stepper", async () => {
      const wrapper = mountBoard([job("s", "draft")]);
      await dragCardTo(wrapper, "s", "Applied");
      expect(markApplied).toHaveBeenCalledWith("s");
      expect(updateJobApplicationStatus).not.toHaveBeenCalled();
    });

    it("dropping a card back on its own lane is a no-op", async () => {
      const wrapper = mountBoard([job("a", "applied")]);
      await dragCardTo(wrapper, "a", "Applied");
      expect(moveToStage).not.toHaveBeenCalled();
    });

    it("dropping onto Closed opens the reason menu instead of setting a status directly", async () => {
      const wrapper = mountBoard([job("a", "applied")]);
      await dragCardTo(wrapper, "a", "Closed");
      expect(updateJobApplicationStatus).not.toHaveBeenCalled();
      const items = [...document.body.querySelectorAll('[role="menuitem"]')].map((item) => item.textContent?.trim());
      expect(items).toEqual(["Hired", "Rejected", "Withdrew", "Archived"]);
    });

    it("picking a reason from the opened menu closes the job with that reason", async () => {
      const wrapper = mountBoard([job("a", "applied")]);
      await dragCardTo(wrapper, "a", "Closed");
      const rejected = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
        (item) => item.textContent?.trim() === "Rejected",
      )!;
      rejected.click();
      await wrapper.vm.$nextTick();
      expect(updateJobApplicationStatus).toHaveBeenCalledWith("a", "rejected");
    });

    it("marks the dragged card and the hovered lane for the lift/highlight styling", async () => {
      const wrapper = mountBoard([job("a", "applied")]);
      await wrapper.find('[data-job-id="a"]').trigger("dragstart", { dataTransfer: dataTransferStub() });
      expect(wrapper.find('[data-job-id="a"]').attributes("data-dragging")).toBe("true");
      const lane = wrapper.find('section[aria-label="Interviewing"]');
      await lane.trigger("dragover", { dataTransfer: dataTransferStub() });
      expect(lane.attributes("data-drag-over")).toBe("true");
      await wrapper.find('[data-job-id="a"]').trigger("dragend");
      expect(wrapper.find('[data-job-id="a"]').attributes("data-dragging")).toBeUndefined();
    });
  });
});
