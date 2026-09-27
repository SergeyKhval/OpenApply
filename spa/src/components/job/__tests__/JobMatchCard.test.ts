import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { h, ref } from "vue";
import type { JobApplication, Resume, ResumeJobMatch } from "@/types";

const matches = ref<ResumeJobMatch[]>([]);
const openFileDialog = vi.fn();
const replace = vi.fn();

vi.mock("vuefire", () => ({
  useCurrentUser: () => ref({ uid: "u1" }),
  useCollection: () => matches,
}));
vi.mock("vue-router", () => ({ useRouter: () => ({ replace }), useRoute: () => ({ query: {} }) }));
vi.mock("@/firebase/config", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(() => ({})),
  where: vi.fn(),
}));
vi.mock("@/composables/useResumeUpload", () => ({
  useResumeUpload: () => ({ openFileDialog, isUploading: ref(false) }),
}));

import JobMatchCard from "../JobMatchCard.vue";

enableAutoUnmount(afterEach);

const application = { id: "j1", companyName: "Northwind Labs", position: "Senior Frontend Engineer", resumeId: "r1" } as JobApplication;
const resume = { id: "r1", fileName: "Maya_Chen_Frontend_2026.pdf" } as Resume;
const match = (overrides: Partial<ResumeJobMatch> = {}) =>
  ({
    resumeId: "r1",
    jobApplicationId: "j1",
    createdAt: { toDate: () => new Date(2026, 8, 24) },
    analysis: {
      matchScore: 82,
      requirements: [
        { requirement: "Vue 3", status: "matched", importance: "must-have", evidence: "" },
        { requirement: "GraphQL", status: "missing", importance: "must-have", evidence: "" },
      ],
      missingKeywords: [],
    },
    matchResult: {
      match_summary: { overall_match_percent: 82, summary: "" },
      recommendations: {},
      skills_comparison: {},
    },
    ...overrides,
  }) as unknown as ResumeJobMatch;

const mountCard = (resumes: Resume[], slots = {}) =>
  mount(JobMatchCard, {
    props: { application, resumes },
    slots,
    global: { stubs: { ResumeMatchSheet: true, TailoredResumeSheet: true, ResumeScore: true, NewResumeButton: true } },
  });

describe("JobMatchCard", () => {
  beforeEach(() => {
    matches.value = [];
    vi.clearAllMocks();
  });

  it("shows the newest match: verdict, must-haves and when it was checked", () => {
    matches.value = [match()];
    const wrapper = mountCard([resume]);
    expect(wrapper.text()).toContain("Likely to pass the first screen");
    expect(wrapper.text()).toContain("1 of 2 must-haves met, missing GraphQL");
    expect(wrapper.text()).toMatch(/Checked .*24/);
    expect(wrapper.findAll("button").map((button) => button.text())).toEqual(["See details", "Write cover letter", "Tailor resume"]);
  });

  it("offers Tailor resume only when the match has an analysis", () => {
    matches.value = [match({ analysis: undefined })];
    const wrapper = mountCard([resume]);
    expect(wrapper.findAll("button").map((button) => button.text())).not.toContain("Tailor resume");
  });

  it("Write cover letter opens the cover letter dialog with the matched resume", async () => {
    matches.value = [match()];
    const wrapper = mountCard([resume]);
    await wrapper.findAll("button")[1].trigger("click");
    expect(replace).toHaveBeenCalledWith({
      query: { "dialog-name": "generate-cover-letter", "application-id": "j1", "resume-id": "r1" },
    });
  });

  it("without a match, asks to check the resume", () => {
    const wrapper = mountCard([resume]);
    expect(wrapper.text()).toContain("Maya_Chen_Frontend_2026.pdf");
    expect(wrapper.find("button").text()).toBe("Check my resume");
  });

  it("without a resume, also offers building one", () => {
    expect(mountCard([]).findComponent({ name: "NewResumeButton" }).attributes("surface")).toBe("job_page");
    expect(mountCard([resume]).findComponent({ name: "NewResumeButton" }).exists()).toBe(false);
  });

  it("without a resume, offers the upload", async () => {
    const wrapper = mountCard([]);
    await wrapper.find("button").trigger("click");
    expect(openFileDialog).toHaveBeenCalled();
  });

  it("shows the free tool's check (fallback) until a match is run here", () => {
    const fallback = { fallback: () => h("p", "tool check") };
    expect(mountCard([resume], fallback).text()).toBe("tool check");
    matches.value = [match()];
    expect(mountCard([resume], fallback).text()).toContain("Likely to pass the first screen");
  });
});
