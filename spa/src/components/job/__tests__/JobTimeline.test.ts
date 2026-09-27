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

const interview = {
  kind: "interview",
  id: "i1",
  date: new Date(2026, 8, 29, 10),
  title: "Tech screen with Dana Ruiz",
  interview: { id: "i1", name: "Tech screen with Dana Ruiz", status: "pending" },
  upcoming: true,
} as unknown as TimelineEntry;

const mountTimeline = (entries: TimelineEntry[], extraProps: Record<string, unknown> = {}) => {
  const actions = {
    addNote: vi.fn().mockResolvedValue(undefined),
    updateNote: vi.fn().mockResolvedValue(undefined),
    saveInterview: vi.fn().mockResolvedValue(undefined),
    setInterviewStatus: vi.fn().mockResolvedValue(undefined),
    saveContact: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  const wrapper = mount(JobTimeline, {
    props: { entries, ...actions, ...extraProps },
    global: { stubs: { InterviewForm: true, ContactForm: true } },
    attachTo: document.body,
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

  it("adds a note on Enter, and Shift+Enter doesn't", async () => {
    const { wrapper, actions } = mountTimeline([]);
    const box = wrapper.find("textarea");
    await box.setValue("Line one");
    await box.trigger("keydown", { key: "Enter", shiftKey: true });
    expect(actions.addNote).not.toHaveBeenCalled();
    await box.trigger("keydown", { key: "Enter" });
    expect(actions.addNote).toHaveBeenCalledWith("Line one");
  });

  it("shows an Add button once there's text, the type picker otherwise", async () => {
    const { wrapper } = mountTimeline([]);
    expect(wrapper.find('button[type="submit"]').exists()).toBe(false);
    expect(wrapper.find('button[aria-label="Add a note, or pick what to add"]').exists()).toBe(true);
    await wrapper.find("textarea").setValue("Ask about on-call");
    expect(wrapper.find('button[type="submit"]').text()).toBe("Add");
  });

  it("the Interview chip swaps the note box for the interview form", async () => {
    const { wrapper } = mountTimeline([]);
    const chip = wrapper.findAll('[role="group"] button').find((button) => button.text() === "Interview")!;
    await chip.trigger("click");
    expect(wrapper.find("textarea").exists()).toBe(false);
    expect(wrapper.findComponent({ name: "InterviewForm" }).exists()).toBe(true);
    expect(chip.attributes("aria-pressed")).toBe("true");
  });

  it("Follow-up lists the templates it's given and asks the page to draft one", async () => {
    const { wrapper } = mountTimeline([], {
      followUpTemplates: [
        { type: "follow_up", label: "Follow-up email" },
        { type: "thank_you", label: "Thank-you note" },
      ],
    });
    const chip = wrapper.findAll('[role="group"] button').find((button) => button.text() === "Follow-up")!;
    await chip.trigger("keydown", { key: "Enter" });
    await new Promise((resolve) => setTimeout(resolve));
    const items = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    expect(items.map((item) => item.textContent?.trim())).toEqual(["Follow-up email", "Thank-you note"]);
    items[1].click();
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("draft")).toEqual([["thank_you"]]);
    wrapper.unmount();
  });

  it("has no Follow-up chip without templates", () => {
    const { wrapper } = mountTimeline([]);
    expect(wrapper.findAll('[role="group"] button').map((button) => button.text())).toEqual([
      "Note",
      "Interview",
      "Contact",
    ]);
  });

  it("opens an entry for editing from outside (the next step's Edit step)", async () => {
    const { wrapper } = mountTimeline([interview]);
    (wrapper.vm as unknown as { edit: (id: string) => void }).edit("i1");
    await wrapper.vm.$nextTick();
    // The composer and the entry each have an interview form stub; the entry's is open now
    expect(wrapper.findAll("ol interview-form-stub")).toHaveLength(1);
  });
});
