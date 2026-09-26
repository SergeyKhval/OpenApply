import { describe, expect, it } from "vitest";
import { initialsOf, planLabel } from "../account";

describe("initialsOf", () => {
  it("takes the first and last name", () => {
    expect(initialsOf("Maya Chen")).toBe("MC");
    expect(initialsOf("  ana maria de la cruz ")).toBe("AC");
  });

  it("uses two letters of a single name", () => {
    expect(initialsOf("Prince")).toBe("PR");
  });

  it("falls back to the email, then to a placeholder", () => {
    expect(initialsOf(null, "j.doe@example.com")).toBe("JD");
    expect(initialsOf("", "")).toBe("?");
  });
});

describe("planLabel", () => {
  const end = { toDate: () => new Date("2026-10-25T12:00:00Z") };

  it("names the plan", () => {
    expect(planLabel("free")).toBe("Free plan");
    expect(planLabel(undefined)).toBe("Free plan");
    expect(planLabel("pro", { currentPeriodEnd: end })).toBe("Pro");
  });

  it("says when a canceled Pro ends", () => {
    expect(planLabel("pro", { cancelAtPeriodEnd: true, currentPeriodEnd: end })).toBe("Pro until October 25");
  });
});
