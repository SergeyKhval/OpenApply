import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { nextTick } from "vue";
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

// jsdom has no layout or PointerEvent: pointer events are MouseEvents, and the lane under the
// pointer comes from a stubbed elementFromPoint
const firePointer = (type: string, target: EventTarget, x: number, y: number) =>
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }));

const pointAtLane = (wrapper: ReturnType<typeof mount>, laneLabel: string) => {
  const lane = wrapper.find(`section[aria-label="${laneLabel}"]`).element;
  document.elementFromPoint = vi.fn(() => lane);
};

const liftCard = async (wrapper: ReturnType<typeof mount>, jobId: string, laneLabel: string) => {
  pointAtLane(wrapper, laneLabel);
  firePointer("pointerdown", wrapper.find(`[data-job-id="${jobId}"] article`).element, 10, 10);
  firePointer("pointermove", window, 60, 40);
  await nextTick();
};

const dragCardTo = async (wrapper: ReturnType<typeof mount>, jobId: string, laneLabel: string) => {
  await liftCard(wrapper, jobId, laneLabel);
  firePointer("pointerup", window, 60, 40);
  await nextTick();
};

// The post-drop click swallower clears itself on the next task, as a real later click would find it
const nextTask = () => new Promise((resolve) => setTimeout(resolve));

describe("JobsBoard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await nextTask();
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
      await nextTask();
      const rejected = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
        (item) => item.textContent?.trim() === "Rejected",
      )!;
      rejected.click();
      await wrapper.vm.$nextTick();
      expect(updateJobApplicationStatus).toHaveBeenCalledWith("a", "rejected");
    });

    it("lifts the card under the cursor, leaves a placeholder and highlights the hovered lane", async () => {
      const wrapper = mountBoard([job("a", "applied")]);
      await liftCard(wrapper, "a", "Interviewing");
      const slot = wrapper.find('[data-job-id="a"]');
      expect(slot.attributes("data-dragging")).toBe("true");
      expect(slot.find("[data-drag-placeholder]").exists()).toBe(true);
      const preview = document.body.querySelector<HTMLElement>("[data-drag-preview]");
      expect(preview?.textContent).toContain("Company a");
      expect(preview?.style.transform).toContain("translate3d");
      expect(wrapper.find('section[aria-label="Interviewing"]').attributes("data-drag-over")).toBe("true");

      firePointer("pointerup", window, 60, 40);
      await nextTick();
      expect(document.body.querySelector("[data-drag-preview]")).toBeNull();
      expect(wrapper.find('[data-job-id="a"]').attributes("data-dragging")).toBeUndefined();
    });

    it("a press that barely moves stays a click: no lift, no move, the click reaches the card", async () => {
      const wrapper = mountBoard([job("a", "applied")]);
      pointAtLane(wrapper, "Interviewing");
      const card = wrapper.find('[data-job-id="a"] article').element;
      firePointer("pointerdown", card, 10, 10);
      firePointer("pointermove", window, 12, 11);
      await nextTick();
      expect(document.body.querySelector("[data-drag-preview]")).toBeNull();
      firePointer("pointerup", window, 12, 11);
      const click = new MouseEvent("click", { bubbles: true, cancelable: true });
      card.dispatchEvent(click);
      expect(click.defaultPrevented).toBe(false);
      expect(moveToStage).not.toHaveBeenCalled();
    });

    it("swallows the click that follows a drop so the card link doesn't open", async () => {
      const wrapper = mountBoard([job("a", "applied")]);
      await dragCardTo(wrapper, "a", "Interviewing");
      const click = new MouseEvent("click", { bubbles: true, cancelable: true });
      document.body.dispatchEvent(click);
      expect(click.defaultPrevented).toBe(true);
    });

    it("Escape cancels the drag without moving the job", async () => {
      const wrapper = mountBoard([job("a", "applied")]);
      await liftCard(wrapper, "a", "Interviewing");
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await nextTick();
      expect(document.body.querySelector("[data-drag-preview]")).toBeNull();
      firePointer("pointerup", window, 60, 40);
      expect(moveToStage).not.toHaveBeenCalled();
    });

    it("pressing a button on the card (I applied) doesn't start a drag", async () => {
      const wrapper = mountBoard([job("s", "draft")]);
      pointAtLane(wrapper, "Applied");
      firePointer("pointerdown", wrapper.find('[data-job-id="s"] button').element, 10, 10);
      firePointer("pointermove", window, 80, 80);
      await nextTick();
      expect(document.body.querySelector("[data-drag-preview]")).toBeNull();
      firePointer("pointerup", window, 80, 80);
      expect(moveToStage).not.toHaveBeenCalled();
    });

    it("releasing outside every lane drops nothing", async () => {
      const wrapper = mountBoard([job("a", "applied")]);
      await liftCard(wrapper, "a", "Interviewing");
      document.elementFromPoint = vi.fn(() => document.body);
      firePointer("pointermove", window, 900, 900);
      firePointer("pointerup", window, 900, 900);
      await nextTick();
      expect(moveToStage).not.toHaveBeenCalled();
    });
  });
});
