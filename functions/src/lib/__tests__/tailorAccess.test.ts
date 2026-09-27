import { describe, expect, it, vi } from "vitest";

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
  assertTailorWithinLimits,
} from "../tailorAccess";

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
