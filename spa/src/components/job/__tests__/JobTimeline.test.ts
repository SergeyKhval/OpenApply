import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import JobTimeline from "../JobTimeline.vue";
import type { TimelineEntry } from "@/lib/timeline";

const note = {
  kind: "note",
  id: "n1",
  date: new Date(2026, 8, 24),
  title: "Note",
  note: { id: "n1", text: "Recruiter said the team uses Vue 3." },
  upcoming: false,
} as unknown as TimelineEntry;
const stage = { kind: "stage", id: "stage-appliedAt", date: new Date(2026, 8, 17), title: "Applied", upcoming: false } as TimelineEntry;

const mountTimeline = (entries: TimelineEntry[]) => {
  const actions = {
    addNote: vi.fn().mockResolvedValue(undefined),
    updateNote: vi.fn().mockResolvedValue(undefined),
    saveInterview: vi.fn().mockResolvedValue(undefined),
    setInterviewStatus: vi.fn().mockResolvedValue(undefined),
    saveContact: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  const wrapper = mount(JobTimeline, {
    props: { entries, ...actions },
    global: { stubs: { InterviewForm: true, ContactForm: true } },
  });
  return { wrapper, actions };
};

describe("JobTimeline", () => {
  it("shows notes and stage changes in one list", () => {
    const { wrapper } = mountTimeline([note, stage]);
    const items = wrapper.findAll("ol > li");
    expect(items).toHaveLength(2);
    expect(items[0].text()).toContain("Recruiter said the team uses Vue 3.");
    expect(items[1].text()).toContain("Applied");
  });

  it("adds a note and clears the box", async () => {
    const { wrapper, actions } = mountTimeline([]);
    await wrapper.find("textarea").setValue("Ask about on-call");
    await wrapper.find("form").trigger("submit");
    expect(actions.addNote).toHaveBeenCalledWith("Ask about on-call");
    expect((wrapper.find("textarea").element as HTMLTextAreaElement).value).toBe("");
  });

  it("ignores empty notes", async () => {
    const { wrapper, actions } = mountTimeline([]);
    await wrapper.find("textarea").setValue("   ");
    await wrapper.find("form").trigger("submit");
    expect(actions.addNote).not.toHaveBeenCalled();
  });

  it("stage changes have no edit or delete menu", () => {
    const { wrapper } = mountTimeline([stage]);
    expect(wrapper.find("ol button").exists()).toBe(false);
  });
});
