import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { computed, ref } from "vue";
import { getAllowanceState } from "@/lib/aiAllowance";
import fixture from "../../../../../shared/tailoredResumeCases.json";

const versions = ref<unknown[]>([]);
const match = ref<unknown>(null);
const usage = ref(3);
const callCreate = vi.fn();
const updateDoc = vi.fn();
const trackEvent = vi.fn();

vi.mock("vuefire", () => ({
  useCurrentUser: () => ref({ uid: "user-1" }),
  useCollection: () => versions,
  useDocument: () => match,
  useFirebaseStorage: () => ({}),
  useStorageFileUrl: () => ({ url: ref(null) }),
}));
vi.mock("firebase/storage", () => ({ ref: () => ({}) }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  doc: (_db: unknown, collectionName: string, id: string) => ({ path: `${collectionName}/${id}` }),
  updateDoc: (...args: unknown[]) => updateDoc(...args),
  serverTimestamp: () => "server-ts",
}));
vi.mock("firebase/functions", () => ({ httpsCallable: () => callCreate }));
vi.mock("@/firebase/config", () => ({ db: {}, functions: {} }));
vi.mock("@/analytics", () => ({ trackEvent: (...args: unknown[]) => trackEvent(...args) }));
vi.mock("@/composables/useAiAllowance", () => ({
  useAiAllowance: () => {
    const allowance = computed(() => getAllowanceState({ aiUsage: { period: "2026-09", count: usage.value } }, new Date("2026-09-25T12:00:00Z")));
    return { allowance, canUseAi: computed(() => allowance.value.canUse) };
  },
}));
vi.mock("@/composables/useProAvailability", () => ({ useProAvailability: () => ({ proAvailable: ref(false) }) }));
vi.mock("@/composables/useProSubscription", () => ({
  useProSubscription: () => ({ isStartingCheckout: ref(false), startProCheckout: vi.fn() }),
}));

import TailoredResumeSheet from "../TailoredResumeSheet.vue";

enableAutoUnmount(afterEach);

const [allKinds] = fixture.cases;
const tailoredVersion = (overrides: Record<string, unknown> = {}) => ({
  id: "tailored-1",
  userId: "user-1",
  resumeId: "resume-1",
  jobApplicationId: "job-1",
  matchId: "match-1",
  lines: allKinds!.lines,
  sectionOrder: allKinds!.sectionOrder,
  ops: allKinds!.ops,
  excludedOpIds: [],
  ...overrides,
});
const MATCH = {
  analysis: {
    matchScore: 70,
    missingKeywords: ["Kubernetes"],
    requirements: [
      { requirement: "Expert React", status: "matched" },
      { requirement: "REST API integration", status: "matched" },
      { requirement: "Kubernetes", status: "missing" },
      { requirement: "PostgreSQL", status: "partial" },
      { requirement: "Led a team", status: "missing" },
    ],
  },
};

const props = {
  open: true,
  resume: { id: "resume-1", fileName: "Sarah_Chen.pdf", storagePath: "resumes/u/r.pdf" },
  application: { id: "job-1", companyName: "Globex", position: "Senior Frontend Engineer" },
} as unknown as InstanceType<typeof TailoredResumeSheet>["$props"];

const body = () => document.body.textContent ?? "";
const button = (label: string) =>
  [...document.body.querySelectorAll("button")].find((candidate) => candidate.textContent?.includes(label));

const mountSheet = async () => {
  const wrapper = mount(TailoredResumeSheet, { props, attachTo: document.body });
  await flushPromises();
  return wrapper;
};

describe("TailoredResumeSheet", () => {
  beforeEach(() => {
    versions.value = [];
    match.value = null;
    usage.value = 3;
    callCreate.mockReset();
    updateDoc.mockReset().mockResolvedValue(undefined);
    trackEvent.mockReset();
  });

  it("explains what it will and won't do before the first run", async () => {
    await mountSheet();
    expect(body()).toContain("We never add a skill, job, title, date, number or degree you don't have.");
    expect(button("Make a tailored version · 1 check")).toBeTruthy();
  });

  it("creates a tailored version for this resume and job", async () => {
    callCreate.mockResolvedValue({ data: { tailoredResumeId: "tailored-1", stats: { proposed: 6, applied: 5, reverted: 1 } } });
    await mountSheet();
    button("Make a tailored version")!.click();
    await flushPromises();
    expect(callCreate).toHaveBeenCalledWith({ resumeId: "resume-1", applicationId: "job-1" });
    expect(trackEvent).toHaveBeenCalledWith("tailored_resume_generated", expect.objectContaining({ applied: 5 }));
  });

  it("says when there was nothing to change, and that no check was used", async () => {
    callCreate.mockResolvedValue({ data: { tailoredResumeId: null, stats: { proposed: 3, applied: 0, reverted: 3 } } });
    await mountSheet();
    button("Make a tailored version")!.click();
    await flushPromises();
    expect(body()).toContain("Nothing to change");
    expect(body()).toContain("No check was used.");
    expect(trackEvent).toHaveBeenCalledWith("tailored_resume_no_changes", { proposed: 3, reverted: 3 });
  });

  it.each([
    ["stale_match", "Your resume changed since the last check."],
    ["no_match", "Check your resume against this job first"],
    ["not_available", "Tailored versions aren't available on your account yet."],
  ])("explains the %s refusal", async (code, text) => {
    callCreate.mockRejectedValue({ message: "server words", details: { code } });
    await mountSheet();
    button("Make a tailored version")!.click();
    await flushPromises();
    expect(body()).toContain(text);
  });

  it("shows the server's own words for a rate limit", async () => {
    callCreate.mockRejectedValue({ message: "You've hit today's limit for tailored versions. Come back tomorrow.", details: { code: "rate_limited" } });
    await mountSheet();
    button("Make a tailored version")!.click();
    await flushPromises();
    expect(body()).toContain("You've hit today's limit for tailored versions.");
  });

  it("shows the out-of-checks panel instead of running", async () => {
    usage.value = 15;
    await mountSheet();
    expect(body()).toContain("You've used your 15 free AI checks this month");
    expect(callCreate).not.toHaveBeenCalled();
  });

  describe("an existing version", () => {
    beforeEach(() => {
      versions.value = [tailoredVersion({ resumeId: "another-resume", id: "other" }), tailoredVersion()];
      match.value = MATCH;
    });

    it("lists each change with the requirement it serves", async () => {
      await mountSheet();
      expect(body()).toContain("5 changes");
      expect(body()).toContain("Maintained PostgreSQL queries for the reporting dashboard.");
      expect(body()).toContain("For: PostgreSQL");
      expect(body()).toContain("Added to Skills");
    });

    it("shows what it kept as the original and why", async () => {
      await mountSheet();
      expect(body()).toContain("Kept as your original");
      expect(body()).toContain("The suggested wording added “led”, which this line doesn't say.");
    });

    it("names the gaps it won't fill", async () => {
      await mountSheet();
      expect(body()).toContain("Kubernetes, Led a team. We won't add these.");
    });

    it("saves a switched-off change and drops it from the preview", async () => {
      await mountSheet();
      const preview = () => document.body.querySelector("article")?.textContent ?? "";
      expect(preview()).toContain("Maintained PostgreSQL queries");

      const rewordSwitch = [...document.body.querySelectorAll("[role=switch]")][1] as HTMLElement;
      rewordSwitch.click();
      await flushPromises();

      expect(updateDoc).toHaveBeenCalledWith({ path: "tailoredResumes/tailored-1" }, { excludedOpIds: [1], updatedAt: "server-ts" });
      expect(preview()).toContain("Maintained Postgres queries for the reporting dashboard.");
      expect(preview()).not.toContain("Maintained PostgreSQL queries");
      expect(body()).toContain("5 changes, 4 switched on");
    });

    it("starts from the switches saved earlier", async () => {
      versions.value = [tailoredVersion({ excludedOpIds: [1] })];
      await mountSheet();
      expect(document.body.querySelector("article")?.textContent).not.toContain("Maintained PostgreSQL queries");
    });
  });
});
