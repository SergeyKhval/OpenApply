import { describe, it, expect } from "vitest";
import { validateCreditBalance, calculateWebhookCredits } from "../credits";

describe("validateCreditBalance", () => {
  // Business rule: a user with fewer credits than the cost cannot perform the action
  it("throws when balance is less than cost", () => {
    expect(() => validateCreditBalance(9, 10)).toThrow();
  });

  it("throws with insufficient-credits detail code", () => {
    try {
      validateCreditBalance(9, 10);
    } catch (e: any) {
      expect(e.code).toBe("failed-precondition");
      expect(e.details?.code).toBe("insufficient-credits");
    }
  });

  it("throws when balance is zero", () => {
    expect(() => validateCreditBalance(0, 10)).toThrow();
  });

  it("throws when balance is negative (defensive)", () => {
    expect(() => validateCreditBalance(-1, 10)).toThrow();
  });

  // Business rule: exact balance match is valid — user can spend their last credits
  it("passes when balance exactly equals cost", () => {
    expect(() => validateCreditBalance(10, 10)).not.toThrow();
  });

  it("passes when balance exceeds cost", () => {
    expect(() => validateCreditBalance(100, 10)).not.toThrow();
  });
});

describe("calculateWebhookCredits", () => {
  const packMap: Record<string, number> = {
    "price_starter": 100,
    "price_pro": 300,
  };

  // Business rule: Stripe price ID must map to a known credit pack
  it("returns correct credits for a valid price ID", () => {
    expect(calculateWebhookCredits("price_starter", packMap)).toBe(100);
  });

  it("returns correct credits for another valid price ID", () => {
    expect(calculateWebhookCredits("price_pro", packMap)).toBe(300);
  });

  // Business rule: unknown price IDs must not silently grant zero credits
  it("throws for unknown price ID", () => {
    expect(() => calculateWebhookCredits("price_fake", packMap)).toThrow();
  });

  it("throws for empty string", () => {
    expect(() => calculateWebhookCredits("", packMap)).toThrow();
  });
});
