import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AiChecksLeft from "../AiChecksLeft.vue";
import type { AllowanceState } from "@/lib/aiAllowance";

const allowance = (overrides: Partial<AllowanceState> = {}): AllowanceState => ({
  plan: "free",
  limit: 15,
  used: 3,
  remaining: 12,
  bonusChecks: 0,
  canUse: true,
  resetsAt: new Date("2026-10-01T00:00:00Z"),
  ...overrides,
});

describe("AiChecksLeft", () => {
  it("shows free checks left this month", () => {
    const wrapper = mount(AiChecksLeft, { props: { allowance: allowance() } });
    expect(wrapper.text()).toContain("12 of 15 free AI checks left this month");
    expect(wrapper.text()).not.toContain("bonus");
  });

  it("shows bonus checks when there are any", () => {
    const wrapper = mount(AiChecksLeft, { props: { allowance: allowance({ bonusChecks: 10 }) } });
    expect(wrapper.text()).toContain("+ 10 bonus checks");
  });

  it("uses the singular for one bonus check", () => {
    const wrapper = mount(AiChecksLeft, { props: { allowance: allowance({ bonusChecks: 1 }) } });
    expect(wrapper.text()).toContain("+ 1 bonus check, used after your monthly ones");
  });

  it("shows Pro checks without 'free'", () => {
    const wrapper = mount(AiChecksLeft, {
      props: { allowance: allowance({ plan: "pro", limit: 150, used: 38, remaining: 112 }) },
    });
    expect(wrapper.text()).toContain("112 of 150 AI checks left this month");
    expect(wrapper.text()).not.toContain("fair-use");
  });

  it("warns Pro users near the fair-use limit", () => {
    const wrapper = mount(AiChecksLeft, {
      props: { allowance: allowance({ plan: "pro", limit: 150, used: 125, remaining: 25 }) },
    });
    expect(wrapper.text()).toContain("close to this month's fair-use limit");
  });
});
