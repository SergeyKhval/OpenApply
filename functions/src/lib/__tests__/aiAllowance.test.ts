import { describe, it, expect } from "vitest";
import {
  usagePeriod,
  nextResetDate,
  isProStatus,
  bonusChecksOf,
  getAllowanceState,
  consumeAiCheck,
  FREE_MONTHLY_CHECKS,
  PRO_MONTHLY_CHECKS,
} from "../aiAllowance";

const sept = new Date("2026-09-24T10:00:00Z");

describe("usagePeriod / nextResetDate", () => {
  it("uses the UTC month", () => {
    expect(usagePeriod(new Date("2026-09-30T23:59:59Z"))).toBe("2026-09");
    expect(usagePeriod(new Date("2026-10-01T00:00:00Z"))).toBe("2026-10");
  });

  it("resets on the first of next UTC month, across years", () => {
    expect(nextResetDate(sept).toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(nextResetDate(new Date("2026-12-15T00:00:00Z")).toISOString()).toBe(
      "2027-01-01T00:00:00.000Z",
    );
  });
});

describe("isProStatus", () => {
  it.each(["active", "trialing", "past_due"])("%s is pro", (status) => {
    expect(isProStatus(status)).toBe(true);
  });

  it.each(["canceled", "unpaid", "incomplete", "incomplete_expired", "paused", null, undefined])(
    "%s is not pro",
    (status) => {
      expect(isProStatus(status)).toBe(false);
    },
  );
});

describe("bonusChecksOf", () => {
  it("prefers the materialized field", () => {
    expect(bonusChecksOf({ bonusChecks: 3, currentBalance: 100 })).toBe(3);
  });

  it("derives from legacy coins, 10 coins per check", () => {
    expect(bonusChecksOf({ currentBalance: 70 })).toBe(7);
  });

  it("caps legacy coins at 200", () => {
    expect(bonusChecksOf({ currentBalance: 99960 })).toBe(20);
  });

  it("is 0 for new or empty profiles", () => {
    expect(bonusChecksOf({})).toBe(0);
    expect(bonusChecksOf(null)).toBe(0);
    expect(bonusChecksOf({ currentBalance: -5 })).toBe(0);
  });
});

describe("getAllowanceState", () => {
  it("gives a free user with no usage 15 checks", () => {
    expect(getAllowanceState({ bonusChecks: 0 }, sept)).toMatchObject({
      plan: "free",
      limit: 15,
      used: 0,
      remaining: 15,
      canUse: true,
    });
  });

  it("resets when the stored period is an older month", () => {
    const state = getAllowanceState(
      { aiUsage: { period: "2026-08", count: 15 }, bonusChecks: 0 },
      sept,
    );
    expect(state.used).toBe(0);
    expect(state.canUse).toBe(true);
  });

  it("lets a free user at the limit use bonus checks", () => {
    const state = getAllowanceState(
      { aiUsage: { period: "2026-09", count: 15 }, currentBalance: 100 },
      sept,
    );
    expect(state).toMatchObject({ remaining: 0, bonusChecks: 10, canUse: true });
  });

  it("blocks a free user at the limit without bonus", () => {
    const state = getAllowanceState(
      { aiUsage: { period: "2026-09", count: 15 }, bonusChecks: 0 },
      sept,
    );
    expect(state.canUse).toBe(false);
  });

  it("gives a pro user 150", () => {
    const state = getAllowanceState(
      { subscriptionStatus: "active", aiUsage: { period: "2026-09", count: 40 } },
      sept,
    );
    expect(state).toMatchObject({ plan: "pro", limit: PRO_MONTHLY_CHECKS, remaining: 110 });
  });

  it("keeps this month's usage against the free limit after pro is canceled", () => {
    const state = getAllowanceState(
      {
        subscriptionStatus: "canceled",
        aiUsage: { period: "2026-09", count: 40 },
        bonusChecks: 0,
      },
      sept,
    );
    expect(state).toMatchObject({
      plan: "free",
      limit: FREE_MONTHLY_CHECKS,
      remaining: 0,
      canUse: false,
    });
  });
});

describe("consumeAiCheck", () => {
  it("spends the monthly allowance first and materializes bonus", () => {
    expect(consumeAiCheck({ currentBalance: 100 }, sept)).toEqual({
      aiUsage: { period: "2026-09", count: 1 },
      bonusChecks: 10,
    });
  });

  it("restarts the count in a new month", () => {
    expect(
      consumeAiCheck({ aiUsage: { period: "2026-08", count: 15 }, bonusChecks: 0 }, sept)
        ?.aiUsage,
    ).toEqual({ period: "2026-09", count: 1 });
  });

  it("spends bonus once the allowance is used up", () => {
    expect(
      consumeAiCheck({ aiUsage: { period: "2026-09", count: 15 }, bonusChecks: 2 }, sept),
    ).toEqual({ aiUsage: { period: "2026-09", count: 15 }, bonusChecks: 1 });
  });

  it("returns null when nothing is left", () => {
    expect(
      consumeAiCheck({ aiUsage: { period: "2026-09", count: 15 }, bonusChecks: 0 }, sept),
    ).toBeNull();
  });
});
