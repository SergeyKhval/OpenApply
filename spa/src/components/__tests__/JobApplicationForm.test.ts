import { describe, it, expect, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
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

describe("JobApplicationForm validation", () => {
  it("shows inline errors for a blank company/position instead of submitting", async () => {
    const wrapper = mount(JobApplicationForm, {});

    await wrapper.find("form").trigger("submit");
    await nextTick();

    expect(wrapper.text()).toContain("Enter the company name");
    expect(wrapper.text()).toContain("Enter the position");
    expect(mockAddJobApplication).not.toHaveBeenCalled();
  });

  it("submits with company and position only, leaving job description empty", async () => {
    // formData is a reactive object passed to addJobApplication by reference,
    // and the component resets it right after a successful save — snapshot
    // the call args immediately instead of inspecting them after the fact.
    let submittedData: Record<string, unknown> | undefined;
    mockAddJobApplication.mockImplementationOnce(async (data: Record<string, unknown>) => {
      submittedData = { ...data };
      return { success: true, id: "abc123" };
    });
    const wrapper = mount(JobApplicationForm, {});

    await wrapper.find("#company").setValue("Acme Corp");
    await flushPromises();
    await wrapper.find("#position").setValue("Senior Engineer");
    await flushPromises();
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(wrapper.text()).not.toContain("Enter the company name");
    expect(submittedData).toMatchObject({
      companyName: "Acme Corp",
      position: "Senior Engineer",
      jobDescription: "",
    });
    expect(wrapper.emitted("saved")).toEqual([["abc123"]]);
  });

  it("labels the job description field as optional", () => {
    const wrapper = mount(JobApplicationForm, {});
    expect(wrapper.text()).toContain("Job Description (optional)");
  });

  it("includes the salary in the submitted payload when filled in", async () => {
    let submittedData: Record<string, unknown> | undefined;
    mockAddJobApplication.mockImplementationOnce(async (data: Record<string, unknown>) => {
      submittedData = { ...data };
      return { success: true, id: "abc123" };
    });
    const wrapper = mount(JobApplicationForm, {});

    await wrapper.find("#company").setValue("Acme Corp");
    await wrapper.find("#position").setValue("Senior Engineer");
    await wrapper.find("#salary").setValue("$120k-140k");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(submittedData).toMatchObject({ salary: "$120k-140k" });
  });

  it("submits an empty salary when left blank", async () => {
    let submittedData: Record<string, unknown> | undefined;
    mockAddJobApplication.mockImplementationOnce(async (data: Record<string, unknown>) => {
      submittedData = { ...data };
      return { success: true, id: "abc123" };
    });
    const wrapper = mount(JobApplicationForm, {});

    await wrapper.find("#company").setValue("Acme Corp");
    await wrapper.find("#position").setValue("Senior Engineer");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(submittedData).toMatchObject({ salary: "" });
  });
});
