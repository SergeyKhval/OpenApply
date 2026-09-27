import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";

vi.mock("@/composables/useAuth", () => ({
  useAuth: () => ({ userProfile: ref({ billingProfile: null }) }),
}));
vi.mock("@/composables/useAiAllowance", () => ({
  useAiAllowance: () => ({
    allowance: ref({ plan: "free", used: 2, limit: 15, remaining: 13, bonusChecks: 0, resetsAt: new Date("2026-10-01") }),
  }),
}));
vi.mock("@/composables/useProAvailability", () => ({
  useProAvailability: () => ({ proAvailable: ref(true) }),
}));

const mockStartProCheckout = vi.fn();
vi.mock("@/composables/useProSubscription", () => ({
  useProSubscription: () => ({
    isStartingCheckout: ref(false),
    isOpeningPortal: ref(false),
    startProCheckout: mockStartProCheckout,
    openBillingPortal: vi.fn(),
  }),
}));

const mockTrackEvent = vi.fn();
vi.mock("@/analytics", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

import PlanPage from "../plan.vue";

const mountPage = () =>
  mount(PlanPage, { global: { stubs: { SettingsShell: { template: "<div><slot /></div>" } } } });

describe("Settings > Plan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tracks upgrade_clicked with source settings_plan and starts checkout", async () => {
    const wrapper = mountPage();
    const upgradeButton = wrapper.findAll("button").find((b) => b.text().includes("Upgrade to Pro"));

    await upgradeButton?.trigger("click");

    expect(mockTrackEvent).toHaveBeenCalledWith("upgrade_clicked", { source: "settings_plan" });
    expect(mockStartProCheckout).toHaveBeenCalledWith("settings_plan");
  });
});
