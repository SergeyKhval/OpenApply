import { describe, it, expect } from "vitest";
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
