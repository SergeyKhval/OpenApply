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
vi.mock("@/analytics", () => ({ trackEvent: vi.fn() }));
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
});
