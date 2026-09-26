import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase-functions/v2/https", () => {
  class HttpsError extends Error {
    code: string;
    details?: unknown;
    constructor(code: string, message: string, details?: unknown) {
      super(message);
      this.code = code;
      this.details = details;
    }
  }
  return { HttpsError };
});

import {
  TAILOR_DAILY_GLOBAL_LIMIT,
  TAILOR_DAILY_LIMIT,
  TAILOR_HOURLY_LIMIT,
  assertTailorAllowed,
  assertTailorWithinLimits,
  tailorAllowlist,
} from "../tailorAccess";

describe("tailorAllowlist", () => {
  afterEach(() => {
    delete process.env.TAILOR_ALLOWED_UIDS;
  });

  it("is empty when unset", () => {
    expect(tailorAllowlist().size).toBe(0);
  });

  it("reads comma-separated uids, ignoring spaces and blanks", () => {
    process.env.TAILOR_ALLOWED_UIDS = " a1 , ,b2,";
    expect([...tailorAllowlist()]).toEqual(["a1", "b2"]);
  });
});

describe("assertTailorAllowed", () => {
  it("lets admins and allowlisted users in", () => {
    expect(() => assertTailorAllowed("u1", true, new Set())).not.toThrow();
    expect(() => assertTailorAllowed("u1", false, new Set(["u1"]))).not.toThrow();
  });

  it("refuses everyone else with a neutral message", () => {
    expect(() => assertTailorAllowed("u1", false, new Set(["u2"]))).toThrow(
      expect.objectContaining({ code: "permission-denied", message: "This isn't available on your account yet." }),
    );
  });
});

describe("assertTailorWithinLimits", () => {
  const under = { hourly: TAILOR_HOURLY_LIMIT - 1, daily: TAILOR_DAILY_LIMIT - 1, global: TAILOR_DAILY_GLOBAL_LIMIT - 1 };

  it("allows the last attempt under each limit", () => {
    expect(() => assertTailorWithinLimits(under)).not.toThrow();
  });

  it.each([
    ["hourly", { ...under, hourly: TAILOR_HOURLY_LIMIT }],
    ["daily", { ...under, daily: TAILOR_DAILY_LIMIT }],
    ["global", { ...under, global: TAILOR_DAILY_GLOBAL_LIMIT }],
  ])("refuses at the %s limit", (_window, counts) => {
    expect(() => assertTailorWithinLimits(counts)).toThrow(expect.objectContaining({ code: "resource-exhausted" }));
  });

  it("uses 10 an hour and 30 a day per account", () => {
    expect([TAILOR_HOURLY_LIMIT, TAILOR_DAILY_LIMIT]).toEqual([10, 30]);
  });
});
