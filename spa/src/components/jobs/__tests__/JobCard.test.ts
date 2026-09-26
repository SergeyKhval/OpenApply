import { describe, expect, it, vi } from "vitest";
import { mount, RouterLinkStub } from "@vue/test-utils";
import type { JobApplication } from "@/types";

vi.mock("@/composables/useUpdateJobApplicationStatus", () => ({
  useUpdateJobApplicationStatus: () => ({ markApplied: vi.fn() }),
}));

vi.mock("@/composables/useJobSignals", async () => {
  const { ref } = await import("vue");
  return { useJobSignals: () => ref([]) };
});

import JobCard from "../JobCard.vue";

const NOW = new Date(2026, 8, 25, 10);
const job = (overrides: Partial<JobApplication> = {}) =>
  ({
    id: "j1",
    companyName: "Acme Corp",
    position: "Engineer",
    status: "draft",
    createdAt: { toDate: () => new Date(2026, 8, 20) },
    ...overrides,
  }) as unknown as JobApplication;

const mountCard = (overrides: Partial<JobApplication> = {}) =>
  mount(JobCard, {
    props: { job: job(overrides), now: NOW },
    global: { stubs: { RouterLink: RouterLinkStub, JobStageMenu: true } },
  });

describe("JobCard salary", () => {
  it("shows the salary in the meta line when set", () => {
    const wrapper = mountCard({ salary: "$120k-140k" });
    expect(wrapper.text()).toContain("$120k-140k");
  });

  it("omits salary from the meta line when not set", () => {
    const wrapper = mountCard();
    expect(wrapper.text()).not.toContain("undefined");
  });
});
