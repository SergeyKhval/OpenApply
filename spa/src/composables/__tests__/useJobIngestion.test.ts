import { describe, it, expect, vi } from "vitest";

vi.mock("@/firebase/config", () => ({
  db: "mock-db",
  functions: "mock-functions",
}));

vi.mock("firebase/firestore", () => ({
  collection: () => "mock-collection-ref",
  doc: () => "mock-doc-ref",
}));

vi.mock("firebase/functions", () => ({
  httpsCallable: () => vi.fn(),
}));

vi.mock("vuefire", () => ({
  useDocument: () => ({ value: undefined }),
}));

vi.mock("@/analytics", () => ({
  trackEvent: vi.fn(),
}));

import { friendlyRequestError } from "../useJobIngestion";

describe("friendlyRequestError", () => {
  it("passes through a safe invalid-argument message", () => {
    const err = Object.assign(new Error("Paste both your resume and the job description."), {
      code: "functions/invalid-argument",
    });
    expect(friendlyRequestError(err)).toBe("Paste both your resume and the job description.");
  });

  it("maps deadline-exceeded to plain language", () => {
    const err = Object.assign(new Error("deadline-exceeded"), { code: "functions/deadline-exceeded" });
    expect(friendlyRequestError(err)).toBe("That took too long. Enter the details yourself instead.");
  });

  it("maps unavailable to a network-flavored message", () => {
    const err = Object.assign(new Error("unavailable"), { code: "functions/unavailable" });
    expect(friendlyRequestError(err)).toContain("internet gremlins");
  });

  it("never leaks a raw internal error code to the user", () => {
    // This is the real bug: Firebase can hand back an HttpsError whose
    // message IS the bare code, e.g. "internal".
    const err = Object.assign(new Error("internal"), { code: "functions/internal" });
    const message = friendlyRequestError(err);
    expect(message).not.toBe("internal");
    expect(message).toContain("Enter the details yourself");
  });

  it("falls back to a generic message for an unknown error shape", () => {
    expect(friendlyRequestError("not an Error instance")).toContain("Enter the details yourself");
    expect(friendlyRequestError(undefined)).toContain("Enter the details yourself");
  });
});
