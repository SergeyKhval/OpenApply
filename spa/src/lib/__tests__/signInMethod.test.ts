import { describe, expect, it } from "vitest";
import { signInMethodLabel } from "../signInMethod";

describe("signInMethodLabel", () => {
  it("names the provider", () => {
    expect(signInMethodLabel(["google.com"])).toBe("Signed in with Google");
    expect(signInMethodLabel(["password"])).toBe("Signed in with a code sent to your email");
  });
  it("lists both when an account has two", () => {
    expect(signInMethodLabel(["password", "google.com"])).toBe("Signed in with a code sent to your email or Google");
  });
  it("falls back to the emailed code for accounts with no provider", () => {
    expect(signInMethodLabel([])).toBe("Signed in with a code sent to your email");
    expect(signInMethodLabel(["custom"])).toBe("Signed in with a code sent to your email");
  });
});
