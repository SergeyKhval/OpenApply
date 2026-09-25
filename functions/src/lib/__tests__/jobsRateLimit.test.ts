import { describe, it, expect } from "vitest";
import {
  DAILY_GLOBAL_LIMIT,
  DAILY_LIMIT_PER_CLIENT,
  HOURLY_LIMIT_PER_CLIENT,
  assertJobsWithinLimits,
} from "../jobsRateLimit";

describe("assertJobsWithinLimits", () => {
  it("allows requests under every limit", () => {
    expect(() => assertJobsWithinLimits({ hourly: 0, daily: 0, global: 0 })).not.toThrow();
  });

  it("blocks at the hourly limit", () => {
    expect(() =>
      assertJobsWithinLimits({ hourly: HOURLY_LIMIT_PER_CLIENT, daily: 0, global: 0 }),
    ).toThrow("this hour");
  });

  it("blocks at the daily limit", () => {
    expect(() =>
      assertJobsWithinLimits({ hourly: 0, daily: DAILY_LIMIT_PER_CLIENT, global: 0 }),
    ).toThrow("today's limit");
  });

  it("blocks at the global limit", () => {
    expect(() =>
      assertJobsWithinLimits({ hourly: 0, daily: 0, global: DAILY_GLOBAL_LIMIT }),
    ).toThrow("today's limit");
  });

  it("never uses an em dash in its messages", () => {
    const messages = [
      () => assertJobsWithinLimits({ hourly: HOURLY_LIMIT_PER_CLIENT, daily: 0, global: 0 }),
      () => assertJobsWithinLimits({ hourly: 0, daily: DAILY_LIMIT_PER_CLIENT, global: 0 }),
      () => assertJobsWithinLimits({ hourly: 0, daily: 0, global: DAILY_GLOBAL_LIMIT }),
    ];
    for (const trigger of messages) {
      try {
        trigger();
      } catch (err) {
        expect((err as Error).message).not.toContain("—");
      }
    }
  });
});
