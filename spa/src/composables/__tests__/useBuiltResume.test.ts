import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { mount } from "@vue/test-utils";

const resumeDoc = ref<Record<string, unknown> | null>(null);
const updateDoc = vi.fn(async (..._args: unknown[]) => undefined);
const addDoc = vi.fn(async (..._args: unknown[]) => ({ id: "new-1" }));
const trackEvent = vi.fn();

vi.mock("vuefire", () => ({
  useCurrentUser: () => ref({ uid: "user-1" }),
  useDocument: () => ({ data: resumeDoc, pending: ref(false), error: ref(null) }),
}));
vi.mock("firebase/firestore", () => ({
  addDoc: (...args: unknown[]) => addDoc(...args),
  collection: (_db: unknown, name: string) => ({ name }),
  doc: (_db: unknown, name: string, id: string) => ({ path: `${name}/${id}` }),
  serverTimestamp: () => "ts",
  updateDoc: (...args: unknown[]) => updateDoc(...args),
}));
vi.mock("@/firebase/config", () => ({ db: {} }));
vi.mock("@/analytics", () => ({ trackEvent: (...args: unknown[]) => trackEvent(...args) }));

import { AUTOSAVE_DELAY_MS, createBuiltResume, useBuiltResume } from "../useBuiltResume";
import { emptyStructuredResume, type StructuredResume } from "@/lib/builtResume";

function built(structured: StructuredResume, extra: Record<string, unknown> = {}) {
  return { id: "r1", kind: "built", title: "Resume", structured, createdAt: { toDate: () => new Date(Date.now() - 10 * 60000) }, ...extra };
}

function setup() {
  let api!: ReturnType<typeof useBuiltResume>;
  const wrapper = mount(
    defineComponent({
      setup() {
        api = useBuiltResume(ref("r1"));
        return () => h("div");
      },
    }),
  );
  return { api, wrapper };
}

const complete = (): StructuredResume => ({
  version: 1,
  contact: { name: "Sarah Chen", headline: "", email: "sarah@example.com", phone: "", location: "", links: [] },
  sections: [
    {
      id: "s1",
      type: "experience",
      heading: "Experience",
      entries: [
        {
          id: "e1",
          title: "Engineer",
          organization: "Globex",
          location: "",
          start: { year: 2021, month: 3 },
          end: "present",
          bullets: [
            { id: "b1", text: "One" },
            { id: "b2", text: "Two" },
            { id: "b3", text: "Three" },
          ],
        },
      ],
    },
  ],
});

describe("useBuiltResume", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    updateDoc.mockClear();
    trackEvent.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads the draft without saving it back", async () => {
    resumeDoc.value = built(emptyStructuredResume({ name: "Sarah Chen" }));
    const { api } = setup();
    await nextTick();
    expect(api.draft.value?.contact.name).toBe("Sarah Chen");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2);
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it("saves a second after the last change, with the derived text", async () => {
    resumeDoc.value = built(emptyStructuredResume({ name: "Sarah Chen" }));
    const { api } = setup();
    await nextTick();
    api.draft.value!.contact.email = "s";
    await nextTick();
    api.draft.value!.contact.email = "sarah@example.com";
    await nextTick();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 10);
    expect(updateDoc).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(20);
    expect(updateDoc).toHaveBeenCalledTimes(1);
    expect(updateDoc.mock.calls[0]![1]).toMatchObject({
      text: "Sarah Chen\nsarah@example.com",
      title: "Resume",
      updatedAt: "ts",
      structured: { contact: { email: "sarah@example.com" } },
    });
    expect(api.saveState.value).toBe("saved");
  });

  it("marks the resume complete once and says so to analytics", async () => {
    const start = complete();
    start.sections[0] = { ...start.sections[0]!, entries: [] } as StructuredResume["sections"][number];
    resumeDoc.value = built(start);
    const { api } = setup();
    await nextTick();
    api.draft.value!.sections = complete().sections;
    await nextTick();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(updateDoc.mock.calls[0]![1]).toMatchObject({ completedAt: "ts" });
    expect(trackEvent).toHaveBeenCalledWith("resume_builder_completed", {
      source: "scratch",
      sections: 1,
      entries: 1,
      bullets: 3,
      minutesSinceStart: 10,
    });

    api.title.value = "Product roles";
    await nextTick();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(updateDoc.mock.calls[1]![1]).not.toHaveProperty("completedAt");
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it("doesn't re-send completion for a resume already complete", async () => {
    resumeDoc.value = built(complete(), { completedAt: "earlier" });
    const { api } = setup();
    await nextTick();
    api.title.value = "Renamed";
    await nextTick();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(updateDoc.mock.calls[0]![1]).not.toHaveProperty("completedAt");
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it("saves right away on unmount instead of losing the last change", async () => {
    resumeDoc.value = built(emptyStructuredResume({ name: "Sarah Chen" }));
    const { api, wrapper } = setup();
    await nextTick();
    api.draft.value!.contact.phone = "+48 600";
    await nextTick();
    wrapper.unmount();
    await Promise.resolve();
    expect(updateDoc).toHaveBeenCalledTimes(1);
  });

  it("says when a save fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    updateDoc.mockRejectedValueOnce(new Error("offline"));
    resumeDoc.value = built(emptyStructuredResume({ name: "Sarah Chen" }));
    const { api } = setup();
    await nextTick();
    api.draft.value!.contact.phone = "1";
    await nextTick();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(api.saveState.value).toBe("error");
  });
});

describe("createBuiltResume", () => {
  it("creates a built resume the rules accept, prefilled from the account", async () => {
    const id = await createBuiltResume("user-1", { name: "Sarah Chen", email: "sarah@example.com" });
    expect(id).toBe("new-1");
    const data = addDoc.mock.calls[0]![1] as Record<string, unknown>;
    expect(Object.keys(data).sort()).toEqual(["createdAt", "kind", "status", "structured", "template", "text", "title", "updatedAt", "userId"]);
    expect(data).toMatchObject({ userId: "user-1", kind: "built", status: "parsed", template: "classic", text: "Sarah Chen\nsarah@example.com" });
    expect((data.structured as StructuredResume).sections.map((section) => [section.type, "entries" in section ? section.entries.length : 0])).toEqual([
      ["experience", 1],
      ["education", 1],
      ["skills", 0],
    ]);
    expect(trackEvent).toHaveBeenCalledWith("resume_builder_started", { source: "scratch" });
  });
});
