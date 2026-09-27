import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";

const mockHttpsCallable = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDoc = vi.fn().mockReturnValue("mock-doc-ref");
const mockCollection = vi.fn().mockReturnValue("mock-collection-ref");
const mockQuery = vi.fn().mockReturnValue("mock-query");
const mockServerTimestamp = vi.fn().mockReturnValue("mock-timestamp");

vi.mock("firebase/firestore", () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  orderBy: vi.fn(),
  query: (...args: unknown[]) => mockQuery(...args),
  serverTimestamp: () => mockServerTimestamp(),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  where: vi.fn(),
}));

vi.mock("firebase/functions", () => ({
  httpsCallable: () => mockHttpsCallable,
}));

vi.mock("@/firebase/config", () => ({
  db: "mock-db",
  functions: "mock-functions",
}));

const mockUser = ref<{ uid: string } | null>({ uid: "user-123" });
vi.mock("vuefire", () => ({
  useCurrentUser: () => mockUser,
  useCollection: () => ({ data: ref([]), pending: ref(false) }),
}));

const mockTrackEvent = vi.fn();
vi.mock("@/analytics", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

import { normalizeFunctionsError, useCoverLetters } from "../useCoverLetters";

describe("normalizeFunctionsError", () => {
  it("handles null", () => {
    const result = normalizeFunctionsError(null);
    expect(result.success).toBe(false);
    expect(result.error).toBe("An unexpected error occurred");
  });

  it("handles undefined", () => {
    const result = normalizeFunctionsError(undefined);
    expect(result.success).toBe(false);
    expect(result.error).toBe("An unexpected error occurred");
  });

  it("handles non-object errors", () => {
    const result = normalizeFunctionsError("string error");
    expect(result.success).toBe(false);
    expect(result.error).toBe("An unexpected error occurred");
  });

  it("extracts message from error objects", () => {
    const result = normalizeFunctionsError({ message: "Something failed" });
    expect(result.success).toBe(false);
    expect(result.error).toBe("Something failed");
  });

  it("uses fallback for empty message", () => {
    const result = normalizeFunctionsError({ message: "" });
    expect(result.success).toBe(false);
    expect(result.error).toBe("An unexpected error occurred");
  });

  it("strips functions/ prefix from code", () => {
    const result = normalizeFunctionsError({
      message: "Error",
      code: "functions/not-found",
    });
    expect(result.code).toBe("not-found");
  });

  it("does not strip non-functions prefix codes", () => {
    const result = normalizeFunctionsError({
      message: "Error",
      code: "auth/invalid-email",
    });
    expect(result.code).toBeUndefined();
  });

  it("extracts code from details.code", () => {
    const result = normalizeFunctionsError({
      message: "Error",
      code: "functions/failed-precondition",
      details: { code: "ai-limit-reached" },
    });
    expect(result.code).toBe("ai-limit-reached");
  });

  it("details.code takes precedence over top-level code", () => {
    const result = normalizeFunctionsError({
      message: "Error",
      code: "functions/something",
      details: { code: "override-code" },
    });
    expect(result.code).toBe("override-code");
  });
});

describe("useCoverLetters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.value = { uid: "user-123" };
  });

  describe("generateCoverLetter", () => {
    it("tracks cover_letter_generated on success", async () => {
      mockHttpsCallable.mockResolvedValueOnce({
        data: { coverLetterId: "cl-1", body: "Dear hiring manager..." },
      });
      const { generateCoverLetter } = useCoverLetters();

      const result = await generateCoverLetter("job-1", "resume-1");

      expect(result).toEqual({
        success: true,
        data: { coverLetterId: "cl-1", body: "Dear hiring manager..." },
      });
      expect(mockTrackEvent).toHaveBeenCalledWith("cover_letter_generated", {
        jobApplicationId: "job-1",
        resumeId: "resume-1",
      });
    });

    it("tracks cover_letter_generation_failed when the callable throws", async () => {
      mockHttpsCallable.mockRejectedValueOnce({
        code: "functions/resource-exhausted",
        message: "AI limit reached",
      });
      const { generateCoverLetter } = useCoverLetters();

      const result = await generateCoverLetter("job-1", "resume-1");

      expect(result.success).toBe(false);
      expect(mockTrackEvent).toHaveBeenCalledWith("cover_letter_generation_failed", {
        error: "AI limit reached",
        code: "resource-exhausted",
      });
    });

    it("does not track anything when the user is signed out", async () => {
      mockUser.value = null;
      const { generateCoverLetter } = useCoverLetters();

      const result = await generateCoverLetter("job-1", "resume-1");

      expect(result).toEqual({ success: false, error: "User not authenticated" });
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });
  });

  describe("regenerateCoverLetter", () => {
    it("tracks cover_letter_regenerated on success", async () => {
      mockHttpsCallable.mockResolvedValueOnce({ data: { body: "Revised letter..." } });
      const { regenerateCoverLetter } = useCoverLetters();

      const result = await regenerateCoverLetter("cl-1", "job-1", "resume-1");

      expect(result).toEqual({ success: true, data: { body: "Revised letter..." } });
      expect(mockTrackEvent).toHaveBeenCalledWith("cover_letter_regenerated");
    });

    it("does not track cover_letter_regenerated when the callable throws", async () => {
      mockHttpsCallable.mockRejectedValueOnce(new Error("boom"));
      const { regenerateCoverLetter } = useCoverLetters();

      await regenerateCoverLetter("cl-1", "job-1", "resume-1");

      expect(mockTrackEvent).not.toHaveBeenCalledWith("cover_letter_regenerated");
    });
  });
});
