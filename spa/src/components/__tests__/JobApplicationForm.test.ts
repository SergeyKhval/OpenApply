import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";

const mockAddJobApplication = vi.fn();

vi.mock("@/composables/useJobApplications", () => ({
  useJobApplications: () => ({
    addJobApplication: mockAddJobApplication,
  }),
}));

import JobApplicationForm from "../JobApplicationForm.vue";

const findClearAllButton = (wrapper: ReturnType<typeof mount>) =>
  wrapper
    .findAll("button")
    .find((button) => button.text().includes("Clear all"));

describe("JobApplicationForm tags", () => {
  it("clears all tags at once when 'Clear all' is clicked", async () => {
    const wrapper = mount(JobApplicationForm, {
      props: {
        technologies: ["Vue", "TypeScript", "Firebase"],
      },
    });

    // All seeded tags are rendered initially.
    expect(wrapper.text()).toContain("Vue");
    expect(wrapper.text()).toContain("TypeScript");
    expect(wrapper.text()).toContain("Firebase");

    const clearButton = findClearAllButton(wrapper);
    expect(clearButton).toBeTruthy();

    await clearButton!.trigger("click");
    await nextTick();

    expect(wrapper.text()).not.toContain("Vue");
    expect(wrapper.text()).not.toContain("TypeScript");
    expect(wrapper.text()).not.toContain("Firebase");
  });

  it("hides the 'Clear all' button when there are no tags", () => {
    const wrapper = mount(JobApplicationForm, {
      props: {
        technologies: [],
      },
    });

    expect(findClearAllButton(wrapper)).toBeUndefined();
  });
});
