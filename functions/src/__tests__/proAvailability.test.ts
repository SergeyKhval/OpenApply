import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase-functions/v2/https", () => ({ onCall: (fn: unknown) => fn }));

import { getProAvailability } from "../proAvailability";

const call = getProAvailability as unknown as () => { proAvailable: boolean };

describe("getProAvailability", () => {
  const original = process.env.STRIPE_PRO_PRICE_ID;
  afterEach(() => {
    if (original === undefined) delete process.env.STRIPE_PRO_PRICE_ID;
    else process.env.STRIPE_PRO_PRICE_ID = original;
  });

  it("says Pro isn't on sale while the price is unset", () => {
    delete process.env.STRIPE_PRO_PRICE_ID;
    expect(call()).toEqual({ proAvailable: false });
  });

  it("treats an empty price as unset", () => {
    process.env.STRIPE_PRO_PRICE_ID = "";
    expect(call()).toEqual({ proAvailable: false });
  });

  it("switches on once the price is configured", () => {
    process.env.STRIPE_PRO_PRICE_ID = "price_123";
    expect(call()).toEqual({ proAvailable: true });
  });
});
