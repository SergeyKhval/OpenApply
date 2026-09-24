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
  CODE_TTL_MS,
  EMAIL_DAILY_SEND_LIMIT,
  EMAIL_HOURLY_SEND_LIMIT,
  GLOBAL_DAILY_SEND_LIMIT,
  IP_HOURLY_SEND_LIMIT,
  MAX_ATTEMPTS,
  assertSendWithinLimits,
  buildSignInCodeEmail,
  codeMatches,
  generateCode,
  hashCode,
  normalizeCode,
  normalizeEmail,
  sendLimitDocIds,
} from "../signInCode";

const withinLimits = { emailHourly: 0, emailDaily: 0, ipHourly: 0, global: 0 };

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Foo.Bar@Example.COM ")).toBe("foo.bar@example.com");
  });

  it.each([undefined, 42, "", "not-an-email", "a@b", "two@@example.com", `${"a".repeat(250)}@example.com`])(
    "rejects %s",
    (value) => {
      expect(() => normalizeEmail(value)).toThrow(
        expect.objectContaining({ code: "invalid-argument" }),
      );
    },
  );
});

describe("normalizeCode", () => {
  it("keeps six digits", () => {
    expect(normalizeCode("012345")).toBe("012345");
  });

  it("accepts spaces and dashes from a pasted code", () => {
    expect(normalizeCode(" 123 456 ")).toBe("123456");
    expect(normalizeCode("123-456")).toBe("123456");
  });

  it.each([undefined, 123456, "12345", "1234567", "abcdef"])("rejects %s", (value) => {
    expect(() => normalizeCode(value)).toThrow(
      expect.objectContaining({ code: "invalid-argument" }),
    );
  });
});

describe("generateCode", () => {
  it("returns six digits, zero padded", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateCode()).toMatch(/^\d{6}$/);
    }
  });

  it("is not constant", () => {
    const codes = new Set(Array.from({ length: 50 }, generateCode));
    expect(codes.size).toBeGreaterThan(40);
  });
});

describe("hashCode / codeMatches", () => {
  it("never stores the code itself", () => {
    expect(hashCode("123456", "salt")).not.toContain("123456");
  });

  it("matches the right code and rejects others", () => {
    const hash = hashCode("123456", "salt");
    expect(codeMatches("123456", "salt", hash)).toBe(true);
    expect(codeMatches("123457", "salt", hash)).toBe(false);
    expect(codeMatches("123456", "other-salt", hash)).toBe(false);
  });

  it("returns false for a malformed stored hash instead of throwing", () => {
    expect(codeMatches("123456", "salt", "abc")).toBe(false);
    expect(codeMatches("123456", "salt", "")).toBe(false);
  });
});

describe("sendLimitDocIds", () => {
  it("builds hourly, daily and global doc ids", () => {
    const ids = sendLimitDocIds("emailkey", "ipkey", new Date("2026-09-24T13:05:00Z"));
    expect(ids).toEqual({
      emailHourly: "email_emailkey_2026092413",
      emailDaily: "email_emailkey_20260924",
      ipHourly: "ip_ipkey_2026092413",
      global: "global_20260924",
    });
  });
});

describe("assertSendWithinLimits", () => {
  it("allows counts below every limit", () => {
    expect(() =>
      assertSendWithinLimits({
        emailHourly: EMAIL_HOURLY_SEND_LIMIT - 1,
        emailDaily: EMAIL_DAILY_SEND_LIMIT - 1,
        ipHourly: IP_HOURLY_SEND_LIMIT - 1,
        global: GLOBAL_DAILY_SEND_LIMIT - 1,
      }),
    ).not.toThrow();
  });

  it.each([
    ["emailHourly", EMAIL_HOURLY_SEND_LIMIT],
    ["emailDaily", EMAIL_DAILY_SEND_LIMIT],
    ["ipHourly", IP_HOURLY_SEND_LIMIT],
    ["global", GLOBAL_DAILY_SEND_LIMIT],
  ])("blocks when %s reaches its limit", (counter, limit) => {
    expect(() => assertSendWithinLimits({ ...withinLimits, [counter]: limit })).toThrow(
      expect.objectContaining({ code: "resource-exhausted" }),
    );
  });
});

describe("constants", () => {
  it("match the security requirements", () => {
    expect(CODE_TTL_MS).toBe(10 * 60 * 1000);
    expect(MAX_ATTEMPTS).toBe(5);
  });
});

describe("buildSignInCodeEmail", () => {
  it("puts the code in the subject and both bodies", () => {
    const email = buildSignInCodeEmail("042917");
    expect(email.subject).toContain("042917");
    expect(email.html).toContain("042917");
    expect(email.text).toContain("042917");
    expect(email.text).toContain("10 minutes");
    expect(email.html).not.toContain("—");
    expect(email.text).not.toContain("—");
  });
});
