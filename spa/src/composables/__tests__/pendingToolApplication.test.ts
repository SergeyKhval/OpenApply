import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PENDING_TOOL_APPLICATION_KEY,
  consumePendingToolApplication,
  hasPendingToolApplication,
  readPendingToolApplication,
  resetPendingToolApplicationState,
  toJobApplicationInput,
  type PendingToolApplication,
} from "../pendingToolApplication";

const savedAt = "2026-09-23T10:00:00.000Z";

const pending: PendingToolApplication = {
  version: 1,
  savedAt,
  companyName: "Acme",
  position: "Frontend Engineer",
  jobDescription: "Build accessible Vue apps.",
  technologies: ["Vue", "TypeScript"],
  match: {
    matchScore: 62,
    verdict: "Close, missing WCAG.",
    parseCheck: { status: "clean", note: "" },
    requirements: [
      { requirement: "Vue", status: "partial", importance: "must-have", evidence: "Built React apps" },
    ],
    missingKeywords: ["WCAG"],
    fixes: [{ gap: "WCAG", where: "Design system", action: "Name WCAG if true" }],
  },
};

const store = (value: unknown) =>
  localStorage.setItem(PENDING_TOOL_APPLICATION_KEY, JSON.stringify(value));

describe("pendingToolApplication", () => {
  beforeEach(() => {
    localStorage.clear();
    resetPendingToolApplicationState();
  });

  describe("readPendingToolApplication", () => {
    it("returns a fresh, valid entry", () => {
      store(pending);
      expect(readPendingToolApplication(new Date(savedAt).getTime() + 1000)).toEqual(pending);
    });

    it("returns null when nothing is saved", () => {
      expect(readPendingToolApplication()).toBeNull();
    });

    it("drops entries older than 7 days", () => {
      store(pending);
      const eightDaysLater = new Date(savedAt).getTime() + 8 * 24 * 60 * 60 * 1000;
      expect(readPendingToolApplication(eightDaysLater)).toBeNull();
      expect(localStorage.getItem(PENDING_TOOL_APPLICATION_KEY)).toBeNull();
    });

    it("drops malformed entries", () => {
      store({ version: 1, companyName: "Acme" });
      expect(readPendingToolApplication()).toBeNull();
      localStorage.setItem(PENDING_TOOL_APPLICATION_KEY, "{not json");
      expect(readPendingToolApplication()).toBeNull();
      expect(localStorage.getItem(PENDING_TOOL_APPLICATION_KEY)).toBeNull();
    });
  });

  describe("toJobApplicationInput", () => {
    it("maps the saved job and attaches the match", () => {
      expect(toJobApplicationInput(pending)).toEqual({
        companyName: "Acme",
        position: "Frontend Engineer",
        jobDescription: "Build accessible Vue apps.",
        technologies: ["Vue", "TypeScript"],
        toolMatch: { ...pending.match, checkedAt: savedAt },
      });
    });

    it("fills required fields the job description didn't state", () => {
      const input = toJobApplicationInput({ ...pending, companyName: "", position: "" });
      expect(input.companyName).toBe("Unknown company");
      expect(input.position).toBe("Unknown position");
    });
  });

  describe("consumePendingToolApplication", () => {
    it("creates the application once and clears the entry", async () => {
      store({ ...pending, savedAt: new Date().toISOString() });
      const addJobApplication = vi.fn().mockResolvedValue({ success: true, id: "app1" });

      const ids = await Promise.all([
        consumePendingToolApplication(addJobApplication),
        consumePendingToolApplication(addJobApplication),
      ]);

      expect(ids).toEqual(["app1", "app1"]);
      expect(addJobApplication).toHaveBeenCalledTimes(1);
      expect(addJobApplication.mock.calls[0][1]).toEqual({ source: "resume_match_tool" });
      expect(localStorage.getItem(PENDING_TOOL_APPLICATION_KEY)).toBeNull();
      expect(hasPendingToolApplication()).toBe(true);
    });

    it("restores the entry when creation fails", async () => {
      store({ ...pending, savedAt: new Date().toISOString() });
      const addJobApplication = vi.fn().mockRejectedValue(new Error("offline"));

      expect(await consumePendingToolApplication(addJobApplication)).toBeNull();
      expect(localStorage.getItem(PENDING_TOOL_APPLICATION_KEY)).not.toBeNull();
    });

    it("does nothing without a saved entry", async () => {
      const addJobApplication = vi.fn();
      expect(await consumePendingToolApplication(addJobApplication)).toBeNull();
      expect(addJobApplication).not.toHaveBeenCalled();
      expect(hasPendingToolApplication()).toBe(false);
    });
  });
});
