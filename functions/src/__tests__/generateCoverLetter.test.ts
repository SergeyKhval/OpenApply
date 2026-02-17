import { describe, it, expect, vi } from "vitest";

// Mock firebase modules before imports
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({}),
  FieldValue: { serverTimestamp: () => "mock-ts", increment: (n: number) => n },
}));

vi.mock("firebase-functions/v2/https", () => {
  class HttpsError extends Error {
    code: string;
    details?: unknown;
    constructor(code: string, message: string, details?: unknown) {
      super(message);
      this.code = code;
      this.details = details;
      this.name = "HttpsError";
    }
  }
  return { HttpsError, onCall: (fn: unknown) => fn };
});

vi.mock("firebase-functions/params", () => ({
  defineString: () => ({ value: () => "" }),
}));

vi.mock("genkit", () => ({
  genkit: () => ({ generate: async () => ({ text: "mock" }) }),
}));

vi.mock("@genkit-ai/googleai", () => {
  const googleAI = () => ({});
  googleAI.model = () => ({});
  return { googleAI };
});

import {
  validateAuth,
  handleError,
  createInsufficientCreditsError,
} from "../generateCoverLetter";

describe("validateAuth", () => {
  it("throws unauthenticated when no auth", () => {
    expect(() => validateAuth({})).toThrow("User must be authenticated");
  });

  it("throws unauthenticated when auth is undefined", () => {
    expect(() => validateAuth({ auth: undefined })).toThrow(
      "User must be authenticated",
    );
  });

  it("returns uid when authenticated", () => {
    const result = validateAuth({ auth: { uid: "user-123" } });
    expect(result).toBe("user-123");
  });
});

describe("handleError", () => {
  it("re-throws HttpsError as-is", () => {
    // Create an error that matches the mocked HttpsError class
    const error = createInsufficientCreditsError("generate");
    expect(() => handleError(error, "generating")).toThrow(error);
  });

  it("wraps non-HttpsError Error in HttpsError", () => {
    try {
      handleError(new Error("something broke"), "generating");
    } catch (err: unknown) {
      const error = err as { code: string; message: string };
      expect(error.code).toBe("internal");
      expect(error.message).toBe("something broke");
    }
  });

  it("wraps non-Error in HttpsError with fallback message", () => {
    try {
      handleError("string error", "regenerating");
    } catch (err: unknown) {
      const error = err as { code: string; message: string };
      expect(error.code).toBe("internal");
      expect(error.message).toBe("Failed to regenerate cover letter");
    }
  });
});

describe("createInsufficientCreditsError", () => {
  it("returns correct error for generate", () => {
    const error = createInsufficientCreditsError("generate");
    expect(error.message).toContain("generate");
    expect(error.message).toContain("10");
    expect((error as unknown as { details: { code: string } }).details.code).toBe(
      "insufficient-credits",
    );
  });

  it("returns correct error for regenerate", () => {
    const error = createInsufficientCreditsError("regenerate");
    expect(error.message).toContain("regenerate");
  });
});
