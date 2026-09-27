import { beforeEach, describe, expect, it, vi } from "vitest";

const callable = vi.fn();
const trackEvent = vi.fn();

vi.mock("firebase/functions", () => ({ httpsCallable: (_functions: unknown, name: string) => (data: unknown) => callable(name, data) }));
vi.mock("@/firebase/config", () => ({ functions: {} }));
vi.mock("@/analytics", () => ({ trackEvent: (...args: unknown[]) => trackEvent(...args) }));

import { importResume } from "../useResumeImport";

const stats = { sections: 3, entries: 4, fieldsVerified: 12, fieldsFlagged: 1, bulletsImported: 10, bulletsUnsorted: 2, linesSkipped: 3 };

describe("importResume", () => {
  beforeEach(() => {
    callable.mockReset();
    trackEvent.mockClear();
  });

  it("imports, counts the start and the result, and returns the new resume", async () => {
    callable.mockResolvedValue({ data: { resumeId: "built-1", fallback: false, stats } });
    const id = await importResume({ source: "linkedin_paste", text: "Sarah Chen ..." });
    expect(id).toBe("built-1");
    expect(callable).toHaveBeenCalledWith("importResume", { source: "linkedin_paste", text: "Sarah Chen ..." });
    expect(trackEvent).toHaveBeenNthCalledWith(1, "resume_builder_started", { source: "linkedin_paste" });
    expect(trackEvent).toHaveBeenNthCalledWith(2, "resume_import_completed", {
      source: "linkedin_paste",
      fieldsVerified: 12,
      fieldsFlagged: 1,
      bulletsImported: 10,
      bulletsUnsorted: 2,
      linesSkipped: 3,
      fallback: false,
      durationMs: expect.any(Number),
    });
  });

  it("counts a failure with its code and throws a message to show", async () => {
    callable.mockRejectedValue({ code: "functions/failed-precondition", message: "There's too little text here.", details: { code: "too_short" } });
    await expect(importResume({ source: "resume", resumeId: "r1" })).rejects.toThrow("There's too little text here.");
    expect(trackEvent).toHaveBeenLastCalledWith("resume_import_failed", { source: "resume", error: "failed-precondition", code: "too_short" });
  });
});
