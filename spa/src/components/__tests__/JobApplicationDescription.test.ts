import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  updateDoc: vi.fn(),
}));

vi.mock("@/firebase/config.ts", () => ({
  db: "mock-db",
}));

import JobApplicationDescription from "../JobApplicationDescription.vue";

describe("JobApplicationDescription", () => {
  it("preserves line breaks when rendering a multi-line description", () => {
    const jobDescription =
      "About the role\n\nResponsibilities:\n- Write code\n- Review PRs";

    const wrapper = mount(JobApplicationDescription, {
      props: { application: { id: "app1", jobDescription } },
    });

    const description = wrapper.find("p");
    expect(description.classes()).toContain("whitespace-pre-line");
    expect(description.classes()).toContain("break-words");
    expect(description.text().replace(/\s+/g, " ")).toContain(
      "About the role Responsibilities: - Write code - Review PRs",
    );
    // whitespace-pre-line handles the visual line breaks, so the underlying
    // text node must still contain the raw newlines rather than collapsing
    // them to spaces itself.
    expect(description.element.textContent).toContain("\n");
  });

  it("collapses runs of 3+ newlines down to a single blank line", () => {
    const jobDescription = "Intro\n\n\n\n\nDetails";

    const wrapper = mount(JobApplicationDescription, {
      props: { application: { id: "app1", jobDescription } },
    });

    const text = wrapper.find("p").element.textContent ?? "";
    expect(text).toBe("Intro\n\nDetails");
  });

  it("still applies line-clamp-5 until 'Show more' is clicked", async () => {
    const jobDescription = "Line one\nLine two";

    const wrapper = mount(JobApplicationDescription, {
      props: { application: { id: "app1", jobDescription } },
    });

    expect(wrapper.find("p").classes()).toContain("line-clamp-5");

    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("Show more"))!
      .trigger("click");

    expect(wrapper.find("p").classes()).not.toContain("line-clamp-5");
  });
});
