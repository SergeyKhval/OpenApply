import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";
import type { AllowanceState } from "@/lib/aiAllowance";

const mockStartProCheckout = vi.fn();
const mockTrackEvent = vi.fn();

vi.mock("@/composables/useProSubscription", () => ({
  useProSubscription: () => ({
    isStartingCheckout: ref(false),
    startProCheckout: mockStartProCheckout,
  }),
}));

const proAvailable = ref<boolean | null>(true);
vi.mock("@/composables/useProAvailability", () => ({
  useProAvailability: () => ({ proAvailable }),
}));

vi.mock("@/analytics", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

import AiLimitReached from "../AiLimitReached.vue";

const allowance = (overrides: Partial<AllowanceState> = {}): AllowanceState => ({
  plan: "free",
  limit: 15,
  used: 15,
  remaining: 0,
  bonusChecks: 0,
  canUse: false,
  resetsAt: new Date("2026-10-01T00:00:00Z"),
  ...overrides,
});

describe("AiLimitReached", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    proAvailable.value = true;
  });

  it("offers Pro to a free user and records the limit hit", () => {
    const wrapper = mount(AiLimitReached, {
      props: { allowance: allowance(), source: "cover_letter" },
    });

    expect(wrapper.text()).toContain("You've used your 15 free AI checks this month");
    expect(wrapper.text()).toContain("They reset on October 1");
    expect(wrapper.text()).toContain("Upgrade to Pro");
    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith("ai_limit_reached", {
      plan: "free",
      source: "cover_letter",
    });
  });

  it("says Pro isn't on sale yet, with no buy button, until the price is set", () => {
    proAvailable.value = false;
    const wrapper = mount(AiLimitReached, {
      props: { allowance: allowance(), source: "cover_letter" },
    });

    expect(wrapper.text()).toContain("Coming soon");
    expect(wrapper.text()).toContain("Pro isn't on sale yet, so there's nothing to buy");
    expect(wrapper.find("button").exists()).toBe(false);
  });

  it("shows no button while it's still asking whether Pro is on sale", () => {
    proAvailable.value = null;
    const wrapper = mount(AiLimitReached, {
      props: { allowance: allowance(), source: "cover_letter" },
    });

    expect(wrapper.find("button").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Coming soon");
  });

  it("starts checkout with the source when Upgrade to Pro is clicked", async () => {
    const wrapper = mount(AiLimitReached, {
      props: { allowance: allowance(), source: "ai_review" },
    });

    await wrapper.get("button").trigger("click");

    expect(mockTrackEvent).toHaveBeenCalledWith("upgrade_clicked", { source: "ai_review" });
    expect(mockStartProCheckout).toHaveBeenCalledWith("ai_review");
  });

  it("gives a Pro user the reset date and a contact route, no upsell", () => {
    const wrapper = mount(AiLimitReached, {
      props: {
        allowance: allowance({ plan: "pro", limit: 150, used: 150 }),
        source: "cover_letter",
      },
    });

    expect(wrapper.text()).toContain("You've used this month's 150 AI checks");
    expect(wrapper.text()).not.toContain("Upgrade to Pro");
    expect(wrapper.find("a[href^='mailto:']").exists()).toBe(true);
  });
});
