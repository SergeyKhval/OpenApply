import { describe, expect, it, vi } from "vitest";
import { mount, RouterLinkStub } from "@vue/test-utils";
import { ref } from "vue";
import { signLines, type JobSignalsDoc, type SignLine } from "@/lib/jobSignals";
import type { JobApplication } from "@/types";

const trackEvent = vi.fn();
vi.mock("@/analytics", () => ({ trackEvent: (...args: unknown[]) => trackEvent(...args) }));
vi.mock("@/composables/useUpdateJobApplicationStatus", () => ({
  useUpdateJobApplicationStatus: () => ({ markApplied: vi.fn() }),
}));
const cardSigns = ref<SignLine[]>([]);
vi.mock("@/composables/useJobSignals", () => ({ useJobSignals: () => cardSigns }));

import JobPostingSignals from "../JobPostingSignals.vue";
import JobCard from "../../jobs/JobCard.vue";

const NOW = new Date(2026, 8, 25, 10);
const doc: JobSignalsDoc = {
  signs: {
    firstSeenAt: "2026-01-10",
    postedAt: "2025-07-27",
    postedAtSource: "json-ld",
    stillListed: { since: "2026-01-10", lastListedAt: "2026-09-20" },
    openApplication: true,
  },
};
const lines = signLines(doc, "Workato", NOW);

describe("JobPostingSignals", () => {
  const wrapper = mount(JobPostingSignals, {
    props: { lines, companyName: "Workato", position: "Data Analyst", link: "https://jobs.lever.co/x/1" },
  });

  it("lists each sign with its source", () => {
    const text = wrapper.text();
    expect(text).toContain("Posting signals");
    for (const line of lines) {
      expect(text).toContain(line.text);
      expect(text).toContain(`Source: ${line.source}`);
    }
  });

  it("stays amber: no verdict words, no red", () => {
    expect(wrapper.text()).not.toMatch(/ghost|scam|fake|likely|fraud|suspicious/i);
    // Unprefixed utilities only: the Button's aria-invalid:ring-destructive never applies here
    expect(wrapper.html()).not.toMatch(/(?<![:\w-])(text|bg|border|ring)-(destructive|red|rose)/);
  });

  it("reports what was shown", () => {
    expect(trackEvent).toHaveBeenCalledWith("job_signals_shown", {
      surface: "app_page",
      sign_types: ["still_listed", "posted", "open_application"],
    });
  });
});

describe("JobCard posting signals", () => {
  const job = {
    id: "a",
    companyName: "Workato",
    position: "Data Analyst",
    status: "applied",
    createdAt: { toDate: () => new Date(2026, 8, 20) },
  } as unknown as JobApplication;
  const mountCard = () =>
    mount(JobCard, {
      props: { job, now: NOW },
      global: { stubs: { RouterLink: RouterLinkStub, JobStageMenu: true } },
    });

  it("shows a count when the job has signals", () => {
    cardSigns.value = lines;
    expect(mountCard().text()).toContain("3 posting signals");
  });

  it("shows nothing without signals (or with the flag off)", () => {
    cardSigns.value = [];
    expect(mountCard().text()).not.toContain("posting signal");
  });
});
