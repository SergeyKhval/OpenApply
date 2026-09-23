import { describe, it, expect, vi } from "vitest";

vi.mock("firebase-functions/v2/https", () => {
  class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  }
  return { HttpsError };
});

import {
  DAILY_GLOBAL_LIMIT,
  DAILY_LIMIT_PER_CLIENT,
  HOURLY_LIMIT_PER_CLIENT,
  MAX_RESUME_CHARS,
  assertWithinLimits,
  buildMatchToolPrompt,
  describeClientIp,
  getClientIp,
  hashClientKey,
  rateLimitWindows,
  validateMatchToolInput,
} from "../matchTool";

const resumeText = "Senior engineer with TypeScript and Vue experience. ".repeat(10);
const jobDescription = "We are hiring a frontend engineer who knows Vue. ".repeat(10);

describe("validateMatchToolInput", () => {
  it("returns trimmed input", () => {
    expect(
      validateMatchToolInput({
        resumeText: `  ${resumeText}  `,
        jobDescription,
      }),
    ).toEqual({ resumeText: resumeText.trim(), jobDescription: jobDescription.trim() });
  });

  it("rejects non-object payloads", () => {
    expect(() => validateMatchToolInput(null)).toThrow("Paste both");
  });

  it("rejects missing fields", () => {
    expect(() => validateMatchToolInput({ resumeText })).toThrow("Paste both");
  });

  it("rejects a short resume", () => {
    expect(() =>
      validateMatchToolInput({ resumeText: "too short", jobDescription }),
    ).toThrow("resume looks too short");
  });

  it("rejects a short job description", () => {
    expect(() =>
      validateMatchToolInput({ resumeText, jobDescription: "short" }),
    ).toThrow("job description looks too short");
  });

  it("rejects an oversized resume", () => {
    expect(() =>
      validateMatchToolInput({
        resumeText: "a".repeat(MAX_RESUME_CHARS + 1),
        jobDescription,
      }),
    ).toThrow("resume is over");
  });
});

describe("getClientIp", () => {
  it("uses the last X-Forwarded-For entry", () => {
    expect(
      getClientIp({ headers: { "x-forwarded-for": "1.1.1.1, 2.2.2.2" }, ip: "3.3.3.3" }),
    ).toBe("2.2.2.2");
  });

  it("falls back to the socket ip", () => {
    expect(getClientIp({ headers: {}, ip: "3.3.3.3" })).toBe("3.3.3.3");
  });

  it("returns null when nothing is available", () => {
    expect(getClientIp({})).toBeNull();
  });
});

describe("describeClientIp", () => {
  it("describes a public client IP behind one proxy hop", () => {
    expect(
      describeClientIp({ headers: { "x-forwarded-for": "203.0.113.7" }, ip: "169.254.1.1" }),
    ).toEqual({
      forwardedCount: 1,
      hasSocketIp: true,
      chosenEqualsSocketIp: false,
      chosenIsValidIp: true,
      chosenIsPrivate: false,
      chosenIsGoogleProxy: false,
    });
  });

  it("flags a Google proxy as the chosen entry", () => {
    const description = describeClientIp({
      headers: { "x-forwarded-for": "1.2.3.4, 203.0.113.7, 35.191.10.20" },
    });
    expect(description.forwardedCount).toBe(3);
    expect(description.chosenIsGoogleProxy).toBe(true);
    expect(description.chosenIsPrivate).toBe(false);
  });

  it("flags private and IPv6 loopback addresses", () => {
    expect(describeClientIp({ headers: { "x-forwarded-for": "10.1.2.3" } }).chosenIsPrivate).toBe(true);
    expect(describeClientIp({ ip: "::1" })).toMatchObject({
      forwardedCount: 0,
      chosenEqualsSocketIp: true,
      chosenIsPrivate: true,
    });
  });

  it("reports unknown ranges for missing or invalid entries", () => {
    expect(describeClientIp({})).toMatchObject({
      chosenIsValidIp: false,
      chosenIsPrivate: null,
      chosenIsGoogleProxy: null,
    });
    expect(
      describeClientIp({ headers: { "x-forwarded-for": "not-an-ip" } }).chosenIsValidIp,
    ).toBe(false);
  });

  it("never includes an address in its output", () => {
    const output = JSON.stringify(
      describeClientIp({ headers: { "x-forwarded-for": "198.51.100.23" }, ip: "198.51.100.23" }),
    );
    expect(output).not.toContain("198.51.100.23");
  });
});

describe("hashClientKey", () => {
  it("is stable and does not contain the raw value", () => {
    const hash = hashClientKey("1.2.3.4");
    expect(hash).toBe(hashClientKey("1.2.3.4"));
    expect(hash).not.toContain("1.2.3.4");
    expect(hash).toHaveLength(32);
  });
});

describe("rateLimitWindows", () => {
  it("builds hourly, daily and global keys in UTC", () => {
    expect(rateLimitWindows("abc", new Date("2026-09-23T07:45:00Z"))).toEqual({
      hourly: "client_abc_2026092307",
      daily: "client_abc_20260923",
      global: "global_20260923",
    });
  });
});

describe("assertWithinLimits", () => {
  it("allows requests under every limit", () => {
    expect(() => assertWithinLimits({ hourly: 0, daily: 0, global: 0 })).not.toThrow();
  });

  it("blocks at the hourly limit", () => {
    expect(() =>
      assertWithinLimits({ hourly: HOURLY_LIMIT_PER_CLIENT, daily: 0, global: 0 }),
    ).toThrow("this hour");
  });

  it("blocks at the daily limit", () => {
    expect(() =>
      assertWithinLimits({ hourly: 0, daily: DAILY_LIMIT_PER_CLIENT, global: 0 }),
    ).toThrow("today's free limit");
  });

  it("blocks at the global limit", () => {
    expect(() =>
      assertWithinLimits({ hourly: 0, daily: 0, global: DAILY_GLOBAL_LIMIT }),
    ).toThrow("daily limit");
  });
});

describe("buildMatchToolPrompt", () => {
  it("embeds both inputs in tagged blocks", () => {
    const prompt = buildMatchToolPrompt({ resumeText: "RESUME", jobDescription: "JOB" });
    expect(prompt).toContain("<resume>\nRESUME\n</resume>");
    expect(prompt).toContain("<job_description>\nJOB\n</job_description>");
  });
});
