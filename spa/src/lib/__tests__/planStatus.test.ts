import { describe, expect, it } from "vitest";
import { proStatusLine, resetLine } from "../planStatus";

const at = (iso: string) => ({ toDate: () => new Date(iso) });

describe("proStatusLine", () => {
  it("says nothing without a subscription", () => {
    expect(proStatusLine(null)).toBeNull();
    expect(proStatusLine({ subscriptionStatus: "active" })).toBeNull();
  });

  it("gives the renewal date and price", () => {
    expect(
      proStatusLine({ subscriptionStatus: "active", currentPeriodEnd: at("2026-10-25T12:00:00Z") }),
    ).toBe("Renews on October 25 for $9.");
  });

  it("gives the end date when canceled", () => {
    expect(
      proStatusLine({
        subscriptionStatus: "active",
        currentPeriodEnd: at("2026-10-25T12:00:00Z"),
        cancelAtPeriodEnd: true,
      }),
    ).toBe("Ends on October 25. You won't be charged again.");
  });

  it("asks for a new card when a payment failed", () => {
    expect(
      proStatusLine({ subscriptionStatus: "past_due", currentPeriodEnd: at("2026-10-25T12:00:00Z") }),
    ).toBe("Your last payment failed. Update your card to keep Pro.");
  });
});

describe("resetLine", () => {
  it("uses the UTC reset day", () => {
    expect(resetLine(new Date("2026-10-01T00:00:00Z"), 12)).toBe("Resets on October 1. 12 left.");
  });
});
