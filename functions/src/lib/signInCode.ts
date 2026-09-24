import { randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { HttpsError } from "firebase-functions/v2/https";

export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 5;

// Send limits: keep one inbox or one IP from being flooded, and cap the
// total so a bot can't burn the Resend quota and lock everyone out of email
// sign-in (Google sign-in keeps working either way).
export const EMAIL_HOURLY_SEND_LIMIT = 5;
export const EMAIL_DAILY_SEND_LIMIT = 10;
export const IP_HOURLY_SEND_LIMIT = 20;
export const GLOBAL_DAILY_SEND_LIMIT = 2000;

const MAX_EMAIL_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const INVALID_CODE_MESSAGE = "That code is wrong or expired. Request a new one.";

/**
 * Lowercases and trims so "Foo@Bar.com " and "foo@bar.com" share one code
 * and one account. Throws invalid-argument on anything that isn't an email.
 */
export function normalizeEmail(value: unknown): string {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    throw new HttpsError("invalid-argument", "Enter a valid email address.");
  }
  return email;
}

/**
 * Accepts a pasted code with spaces or a dash ("123 456", "123-456").
 */
export function normalizeCode(value: unknown): string {
  const code = typeof value === "string" ? value.replace(/[\s-]/g, "") : "";
  if (!/^\d{6}$/.test(code)) {
    throw new HttpsError("invalid-argument", "Enter the 6-digit code from the email.");
  }
  return code;
}

export function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/**
 * Slow salted hash: a leaked code doc can't be brute forced over the
 * million possible codes before the code expires.
 */
export function hashCode(code: string, salt: string): string {
  return scryptSync(code, salt, 32).toString("hex");
}

export function codeMatches(code: string, salt: string, expectedHash: string): boolean {
  const expected = Buffer.from(expectedHash, "hex");
  const actual = Buffer.from(hashCode(code, salt), "hex");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

/**
 * Doc ids of the send counters in `signInCodeLimits`.
 */
export function sendLimitDocIds(emailKey: string, ipKey: string, now: Date) {
  const iso = now.toISOString();
  const day = iso.slice(0, 10).replace(/-/g, "");
  const hour = `${day}${iso.slice(11, 13)}`;

  return {
    emailHourly: `email_${emailKey}_${hour}`,
    emailDaily: `email_${emailKey}_${day}`,
    ipHourly: `ip_${ipKey}_${hour}`,
    global: `global_${day}`,
  };
}

export type SendCounts = Record<keyof ReturnType<typeof sendLimitDocIds>, number>;

export function assertSendWithinLimits(counts: SendCounts): void {
  if (counts.global >= GLOBAL_DAILY_SEND_LIMIT) {
    throw new HttpsError(
      "resource-exhausted",
      "Email sign-in is busy right now. Try again later, or sign in with Google.",
    );
  }
  if (
    counts.emailHourly >= EMAIL_HOURLY_SEND_LIMIT ||
    counts.emailDaily >= EMAIL_DAILY_SEND_LIMIT ||
    counts.ipHourly >= IP_HOURLY_SEND_LIMIT
  ) {
    throw new HttpsError(
      "resource-exhausted",
      "Too many codes requested. Wait a while and try again, or sign in with Google.",
    );
  }
}

export function buildSignInCodeEmail(code: string) {
  const subject = `${code} is your OpenApply code`;
  const text = [
    `Your OpenApply sign-in code is ${code}`,
    "",
    "It expires in 10 minutes.",
    "",
    "If you didn't ask for this code, you can ignore this email.",
  ].join("\n");
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;">
    <p style="margin:0 0 16px;">Your OpenApply sign-in code:</p>
    <p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:6px;">${code}</p>
    <p style="margin:0 0 16px;">It expires in 10 minutes.</p>
    <p style="margin:0;color:#6b7280;font-size:13px;">If you didn't ask for this code, you can ignore this email.</p>
  </body>
</html>`;
  return { subject, html, text };
}
