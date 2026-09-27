import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import type { JobApplication } from "@/types";

vi.mock("@/components/jobs/JobListRow.vue", () => ({
  default: { props: ["job"], template: "<p class='row'>{{ job.companyName }}</p>" },
}));

import JobsMobileList from "../JobsMobileList.vue";

const at = (day: number) => ({ toDate: () => new Date(2026, 8, day) });
const job = (companyName: string, status: string, followUpDay?: number) =>
  ({ id: companyName, companyName, status, followUpAt: followUpDay ? at(followUpDay) : null }) as unknown as JobApplication;

describe("JobsMobileList", () => {
  it("groups by stage, applied first, soonest follow-up first within a stage", () => {
    const wrapper = mount(JobsMobileList, {
      props: {
        jobs: [job("Cobalt", "applied"), job("Harbor", "applied", 28), job("Brightline", "applied", 25), job("Quillsoft", "draft")],
        now: new Date(2026, 8, 25),
      },
    });
    expect(wrapper.findAll("h3").map((heading) => heading.text().replace(/\s+/g, " "))).toEqual(["Applied 3", "Saved 1"]);
    expect(wrapper.findAll(".row").map((row) => row.text())).toEqual(["Brightline", "Harbor", "Cobalt", "Quillsoft"]);
  });
});
