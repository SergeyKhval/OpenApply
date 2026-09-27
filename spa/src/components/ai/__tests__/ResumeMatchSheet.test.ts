import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { computed, ref } from "vue";
import { getAllowanceState } from "@/lib/aiAllowance";

const matches = ref<unknown[]>([]);
const usage = ref(3);
const callMatch = vi.fn();

vi.mock("vuefire", () => ({
  useCurrentUser: () => ref({ uid: "user-1" }),
  useCollection: () => matches,
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
}));
vi.mock("firebase/functions", () => ({ httpsCallable: () => callMatch }));
vi.mock("@/firebase/config", () => ({ db: {}, functions: {} }));
vi.mock("vue-router", () => ({ useRouter: () => ({ replace: vi.fn() }), useRoute: () => ({ query: {} }) }));
const trackEvent = vi.fn();
vi.mock("@/analytics", () => ({ trackEvent: (...args: unknown[]) => trackEvent(...args) }));
vi.mock("@/composables/useAiAllowance", () => ({
  useAiAllowance: () => {
    const allowance = computed(() => getAllowanceState({ aiUsage: { period: "2026-09", count: usage.value } }, new Date("2026-09-25T12:00:00Z")));
    return { allowance, canUseAi: computed(() => allowance.value.canUse) };
  },
}));
vi.mock("@/components/resume-builder/RebuildResumeButton.vue", async () => {
  const { defineComponent, h } = await import("vue");
  return {
    default: defineComponent({
      name: "RebuildResumeButton",
      props: ["resume", "surface"],
      setup: (componentProps, { slots }) => () => h("button", { "data-surface": componentProps.surface }, slots.default?.()),
    }),
  };
});
vi.mock("@/composables/useProAvailability", () => ({ useProAvailability: () => ({ proAvailable: ref(false) }) }));
vi.mock("@/composables/useProSubscription", () => ({
  useProSubscription: () => ({ isStartingCheckout: ref(false), startProCheckout: vi.fn() }),
}));

import ResumeMatchSheet from "../ResumeMatchSheet.vue";

enableAutoUnmount(afterEach);

const props = {
  open: true,
  resume: { id: "resume-1", fileName: "Maya_Chen_Frontend_2026.pdf", storagePath: "resumes/u/r.pdf" },
  application: { id: "job-1", companyName: "Northwind Labs", position: "Senior Frontend Engineer", jobDescription: "Vue" },
} as unknown as InstanceType<typeof ResumeMatchSheet>["$props"];

const body = () => document.body.textContent ?? "";
const buttons = () => [...document.body.querySelectorAll("button")].map((button) => button.textContent?.trim());

const mountSheet = async () => {
  const wrapper = mount(ResumeMatchSheet, { props, attachTo: document.body });
  await flushPromises();
  return wrapper;
};

describe("ResumeMatchSheet", () => {
  beforeEach(() => {
    matches.value = [];
    usage.value = 3;
    callMatch.mockReset();
  });

  it("shows the latest match: verdict, requirements and fixes", async () => {
    matches.value = [
      {
        matchResult: {
          match_summary: { overall_match_percent: 82, summary: "" },
          recommendations: { improvement_areas: ["Add the Pinia store to the checkout bullet."] },
          skills_comparison: {
            matched_skills: [{ skill: "Vue 3", evidence: "Led the move to Vue 3", status: "matched" }],
            missing_skills: [{ skill: "GraphQL", status: "matched" }],
          },
        },
      },
    ];
    await mountSheet();
    expect(body()).toContain("Northwind Labs · Senior Frontend Engineer");
    expect(body()).toContain("Likely to pass the first screen");
    expect(body()).toContain("1 of 2 requirements met, 1 missing");
    expect(body()).toContain("Not in your resume");
    expect(body()).toContain("1 fix before you apply");
    expect(buttons()).toContain("Write a cover letter for this job");
  });

  it("runs a match for one check", async () => {
    callMatch.mockResolvedValue({ data: {} });
    await mountSheet();
    const run = [...document.body.querySelectorAll("button")].find((button) => button.textContent?.includes("Check my resume"))!;
    run.click();
    await flushPromises();
    expect(callMatch).toHaveBeenCalledWith({ resumeId: "resume-1", applicationId: "job-1" });
    expect(trackEvent).toHaveBeenCalledWith("resume_match_started", { resumeId: "resume-1", jobApplicationId: "job-1", resumeKind: "upload" });
  });

  it("says so up front when the month's checks are used, with nothing to buy while Pro is off", async () => {
    usage.value = 15;
    await mountSheet();
    expect(body()).toContain("You've used your 15 free AI checks this month");
    expect(body()).toContain("Pro isn't on sale yet");
    expect(buttons().some((label) => label?.includes("Check my resume"))).toBe(false);
  });

  it("switches to the limit box when the server says the checks ran out", async () => {
    callMatch.mockRejectedValue({ details: { code: "ai-limit-reached" } });
    await mountSheet();
    [...document.body.querySelectorAll("button")].find((button) => button.textContent?.includes("Check my resume"))!.click();
    await flushPromises();
    expect(body()).toContain("free AI checks this month");
  });

  describe("tailored version", () => {
    const latest = (analysis?: unknown) => ({
      matchResult: {
        match_summary: { overall_match_percent: 70, summary: "" },
        recommendations: {},
        skills_comparison: { matched_skills: [{ skill: "Vue 3", evidence: "Led the move to Vue 3", status: "matched" }] },
      },
      ...(analysis ? { analysis } : {}),
    });

    it("is hidden for an older match without the stored analysis", async () => {
      matches.value = [latest()];
      await mountSheet();
      expect(buttons()).not.toContain("Make a tailored version");
    });

    it("hands off to the tailored sheet", async () => {
      matches.value = [latest({ requirements: [] })];
      const wrapper = await mountSheet();
      [...document.body.querySelectorAll("button")].find((button) => button.textContent?.includes("Make a tailored version"))!.click();
      await flushPromises();
      expect(wrapper.emitted("tailor")).toHaveLength(1);
      expect(wrapper.emitted("update:open")).toEqual([[false]]);
    });
  });

  describe("a resume whose text came out jumbled", () => {
    const withParseCheck = (status: string, note = "") => ({
      matchResult: { match_summary: { overall_match_percent: 60, summary: "" }, recommendations: {}, skills_comparison: {} },
      analysis: { matchScore: 60, missingKeywords: [], requirements: [], parseCheck: { status, note } },
    });

    it("says so and offers a rebuild in the editor", async () => {
      matches.value = [withParseCheck("scrambled", "Two columns run into each other.")];
      await mountSheet();
      expect(body()).toContain("Your resume's text came out jumbled");
      expect(body()).toContain("Two columns run into each other.");
      expect(document.body.querySelector('[data-surface="match_parse_check"]')?.textContent).toContain("Rebuild it in the editor");
    });

    it("stays quiet for clean text", async () => {
      matches.value = [withParseCheck("clean")];
      await mountSheet();
      expect(body()).not.toContain("jumbled");
      expect(document.body.querySelector('[data-surface="match_parse_check"]')).toBeNull();
    });
  });
});
