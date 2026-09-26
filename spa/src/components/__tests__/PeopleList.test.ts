import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { mount, RouterLinkStub } from "@vue/test-utils";
import type { PersonGroup } from "@/lib/people";

const person = (overrides: Partial<PersonGroup> = {}): PersonGroup => ({
  key: "email:dana@example.com",
  firstName: "Dana",
  lastName: "Ruiz",
  email: "dana@example.com",
  position: "Engineering Manager",
  jobs: [{ jobApplicationId: "job-1", companyName: "Northwind Labs", position: "Backend Engineer" }],
  lastInteractionAt: new Date(2026, 8, 20),
  ...overrides,
});

const peopleRef = ref<PersonGroup[]>([]);
vi.mock("@/composables/usePeople", () => ({
  usePeople: () => ({ people: peopleRef, isLoading: ref(false) }),
}));

import PeopleList from "../PeopleList.vue";

describe("PeopleList", () => {
  it("shows an empty state with no contacts", () => {
    peopleRef.value = [];
    const wrapper = mount(PeopleList, { global: { stubs: { RouterLink: RouterLinkStub } } });
    expect(wrapper.text()).toContain("No contacts yet");
  });

  it("lists a person with their linked jobs and last interaction date", () => {
    peopleRef.value = [person()];
    const wrapper = mount(PeopleList, { global: { stubs: { RouterLink: RouterLinkStub } } });
    expect(wrapper.text()).toContain("Dana Ruiz");
    expect(wrapper.text()).toContain("Engineering Manager");
    expect(wrapper.text()).toContain("Northwind Labs");
    expect(wrapper.text()).toContain("dana@example.com");
    expect(wrapper.text()).toContain("Last contact");
    const jobLink = wrapper.findComponent(RouterLinkStub);
    expect(jobLink.props("to")).toBe("/jobs/job-1");
  });

  it("lists every job a person is linked to across companies", () => {
    peopleRef.value = [
      person({
        jobs: [
          { jobApplicationId: "job-1", companyName: "Northwind Labs", position: "Backend Engineer" },
          { jobApplicationId: "job-2", companyName: "Acme Corp", position: "Staff Engineer" },
        ],
      }),
    ];
    const wrapper = mount(PeopleList, { global: { stubs: { RouterLink: RouterLinkStub } } });
    expect(wrapper.text()).toContain("Northwind Labs");
    expect(wrapper.text()).toContain("Acme Corp");
  });

  it("falls back to the email when the person has no name", () => {
    peopleRef.value = [person({ firstName: "", lastName: "", position: "" })];
    const wrapper = mount(PeopleList, { global: { stubs: { RouterLink: RouterLinkStub } } });
    expect(wrapper.text()).toContain("dana@example.com");
  });
});
