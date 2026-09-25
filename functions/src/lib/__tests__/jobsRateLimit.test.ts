import { describe, it, expect } from "vitest";
import {
  DAILY_GLOBAL_LIMIT,
  DAILY_LIMIT_PER_ACCOUNT,
  DAILY_LIMIT_PER_IP,
  HOURLY_LIMIT_PER_ACCOUNT,
  HOURLY_LIMIT_PER_IP,
  assertJobsWithinLimits,
} from "../jobsRateLimit";

describe("assertJobsWithinLimits", () => {
  it("allows requests under every limit", () => {
    expect(() => assertJobsWithinLimits({ hourly: 0, daily: 0, global: 0 }, "ip")).not.toThrow();
    expect(() => assertJobsWithinLimits({ hourly: 0, daily: 0, global: 0 }, "account")).not.toThrow();
  });

  it("blocks an anonymous/IP caller at the IP hourly limit", () => {
    expect(() =>
      assertJobsWithinLimits({ hourly: HOURLY_LIMIT_PER_IP, daily: 0, global: 0 }, "ip"),
    ).toThrow("this hour");
  });

  it("blocks an anonymous/IP caller at the IP daily limit", () => {
    expect(() =>
      assertJobsWithinLimits({ hourly: 0, daily: DAILY_LIMIT_PER_IP, global: 0 }, "ip"),
    ).toThrow("today's limit");
  });

  it("does not block a signed-in account at the IP tier's hourly count", () => {
    expect(() =>
      assertJobsWithinLimits({ hourly: HOURLY_LIMIT_PER_IP, daily: 0, global: 0 }, "account"),
    ).not.toThrow();
  });

  it("blocks a signed-in account only once it reaches the higher account hourly limit", () => {
    expect(() =>
      assertJobsWithinLimits({ hourly: HOURLY_LIMIT_PER_ACCOUNT - 1, daily: 0, global: 0 }, "account"),
    ).not.toThrow();
    expect(() =>
      assertJobsWithinLimits({ hourly: HOURLY_LIMIT_PER_ACCOUNT, daily: 0, global: 0 }, "account"),
    ).toThrow("this hour");
  });

  it("blocks a signed-in account at the higher account daily limit", () => {
    expect(() =>
      assertJobsWithinLimits({ hourly: 0, daily: DAILY_LIMIT_PER_ACCOUNT, global: 0 }, "account"),
    ).toThrow("today's limit");
  });

  it("account limits are strictly higher than IP limits", () => {
    expect(HOURLY_LIMIT_PER_ACCOUNT).toBeGreaterThan(HOURLY_LIMIT_PER_IP);
    expect(DAILY_LIMIT_PER_ACCOUNT).toBeGreaterThan(DAILY_LIMIT_PER_IP);
  });

  it("blocks at the global limit regardless of tier", () => {
    expect(() =>
      assertJobsWithinLimits({ hourly: 0, daily: 0, global: DAILY_GLOBAL_LIMIT }, "ip"),
    ).toThrow("today's limit");
    expect(() =>
      assertJobsWithinLimits({ hourly: 0, daily: 0, global: DAILY_GLOBAL_LIMIT }, "account"),
    ).toThrow("today's limit");
  });

  it("never uses an em dash in its messages", () => {
    const messages = [
      () => assertJobsWithinLimits({ hourly: HOURLY_LIMIT_PER_IP, daily: 0, global: 0 }, "ip"),
      () => assertJobsWithinLimits({ hourly: 0, daily: DAILY_LIMIT_PER_IP, global: 0 }, "ip"),
      () => assertJobsWithinLimits({ hourly: 0, daily: 0, global: DAILY_GLOBAL_LIMIT }, "ip"),
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
