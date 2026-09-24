import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import ToolMatchCard from "../ToolMatchCard.vue";
import type { ToolMatch } from "@/types";

function stubMatchMedia(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const baseMatch: ToolMatch = {
  matchScore: 82,
  verdict: "Strong match",
  parseCheck: { status: "clean", note: "Looks good" },
  requirements: [
    {
      requirement: "5+ years React",
      status: "matched",
      importance: "must-have",
      evidence: "5 years of React experience",
    },
  ],
  missingKeywords: ["GraphQL"],
  fixes: [{ gap: "GraphQL", where: "Skills", action: "Add GraphQL experience" }],
  checkedAt: new Date().toISOString(),
};

describe("ToolMatchCard", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    // Default to desktop width so tests unrelated to the collapse behavior
    // see the fully expanded card, matching current jsdom-less behavior.
    stubMatchMedia(true);
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("shows an 'I applied' button in the just-saved alert and emits mark-applied on click", async () => {
    const wrapper = mount(ToolMatchCard, {
      props: { match: baseMatch, justSaved: true },
    });

    expect(wrapper.text()).not.toContain("above");

    const applyButton = wrapper
      .findAll("button")
      .find((button) => button.text() === "I applied");
    expect(applyButton).toBeTruthy();

    await applyButton!.trigger("click");

    expect(wrapper.emitted("mark-applied")).toHaveLength(1);
    expect(wrapper.text()).toContain("Marked as Applied");
    expect(
      wrapper.findAll("button").find((button) => button.text() === "I applied"),
    ).toBeUndefined();
  });

  it("does not render the just-saved alert when justSaved is false", () => {
    const wrapper = mount(ToolMatchCard, {
      props: { match: baseMatch, justSaved: false },
    });

    expect(wrapper.text()).not.toContain("Saved from your match check");
  });

  it("shows a 'See details' toggle when collapsed and reveals requirements on click", async () => {
    stubMatchMedia(false);

    const wrapper = mount(ToolMatchCard, {
      props: { match: baseMatch, justSaved: false },
    });

    expect(wrapper.text()).toContain("See details");
    expect(wrapper.text()).not.toContain("5+ years React");

    const detailsButton = wrapper
      .findAll("button")
      .find((button) => button.text() === "See details");
    await detailsButton!.trigger("click");

    expect(wrapper.text()).toContain("5+ years React");
    expect(wrapper.text()).not.toContain("See details");
  });
});
