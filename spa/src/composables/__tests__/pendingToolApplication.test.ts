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

// What /save stores for a job the browser extension read from the page
const extensionPending: PendingToolApplication = {
  version: 1,
  savedAt,
  source: "extension",
  companyName: "ASTEK Polska",
  position: "Starszy Programista Full-stack",
  location: "Warszawa, mazowieckie · Remote",
  jobDescription: "Wymagania: Vue.js 3, PHP.",
  jobDescriptionLink: "https://theprotocol.it/szczegoly/praca/x,oferta,1",
  technologies: [],
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

    it("accepts a job from the extension without a match check", () => {
      store(extensionPending);
      expect(readPendingToolApplication(new Date(savedAt).getTime() + 1000)).toEqual(extensionPending);
    });

    it("accepts a job from the extension with a salary", () => {
      const withSalary = { ...extensionPending, salary: "$120k-140k" };
      store(withSalary);
      expect(readPendingToolApplication(new Date(savedAt).getTime() + 1000)).toEqual(withSalary);
    });

    it("requires a match check for jobs from the match tool", () => {
      const { match: _match, ...withoutMatch } = pending;
      store(withoutMatch);
      expect(readPendingToolApplication(new Date(savedAt).getTime() + 1000)).toBeNull();
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

    it("keeps the posting link from the browser extension", () => {
      const input = toJobApplicationInput({
        ...pending,
        jobDescriptionLink: "https://boards.greenhouse.io/acme/jobs/1",
      });
      expect(input.jobDescriptionLink).toBe("https://boards.greenhouse.io/acme/jobs/1");
    });

    it("drops a posting link that isn't a web URL", () => {
      const input = toJobApplicationInput({ ...pending, jobDescriptionLink: "javascript:alert(1)" });
      expect(input).not.toHaveProperty("jobDescriptionLink");
    });

    it("maps an extension job with its location and no match", () => {
      expect(toJobApplicationInput(extensionPending)).toEqual({
        companyName: "ASTEK Polska",
        position: "Starszy Programista Full-stack",
        jobDescription: "Location: Warszawa, mazowieckie · Remote\n\nWymagania: Vue.js 3, PHP.",
        jobDescriptionLink: "https://theprotocol.it/szczegoly/praca/x,oferta,1",
        technologies: [],
        remotePolicy: "remote",
      });
    });

    it("keeps the posting dates the extension read, sanitized", () => {
      const input = toJobApplicationInput({
        ...extensionPending,
        posting: { postedAt: "2025-05-16", postedAtSource: "json-ld", reposted: true },
      });
      expect(input.posting).toEqual({ postedAt: "2025-05-16", postedAtSource: "json-ld", reposted: true });

      const tampered = toJobApplicationInput({
        ...extensionPending,
        posting: { postedAt: "2999-01-01", postedAtSource: "json-ld" } as never,
      });
      expect(tampered).not.toHaveProperty("posting");
    });

    it("leaves the description alone without a location", () => {
      const input = toJobApplicationInput({ ...extensionPending, location: "" });
      expect(input.jobDescription).toBe("Wymagania: Vue.js 3, PHP.");
      expect(input).not.toHaveProperty("remotePolicy");
    });

    it("fills required fields the job description didn't state", () => {
      const input = toJobApplicationInput({ ...pending, companyName: "", position: "" });
      expect(input.companyName).toBe("Unknown company");
      expect(input.position).toBe("Unknown position");
    });

    it("keeps the salary the extension read", () => {
      const input = toJobApplicationInput({ ...extensionPending, salary: "$120k-140k" });
      expect(input.salary).toBe("$120k-140k");
    });

    it("omits salary when the extension didn't find one", () => {
      expect(toJobApplicationInput(extensionPending)).not.toHaveProperty("salary");
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

      expect(ids).toEqual([
        { id: "app1", source: "resume_match_tool" },
        { id: "app1", source: "resume_match_tool" },
      ]);
      expect(addJobApplication).toHaveBeenCalledTimes(1);
      expect(addJobApplication.mock.calls[0][1]).toEqual({ source: "resume_match_tool" });
      expect(localStorage.getItem(PENDING_TOOL_APPLICATION_KEY)).toBeNull();
      expect(hasPendingToolApplication()).toBe(true);
    });

    it("creates an extension job as an extension application", async () => {
      store({ ...extensionPending, savedAt: new Date().toISOString() });
      const addJobApplication = vi.fn().mockResolvedValue({ success: true, id: "app2" });

      expect(await consumePendingToolApplication(addJobApplication)).toEqual({ id: "app2", source: "extension" });
      expect(addJobApplication.mock.calls[0][1]).toEqual({ source: "extension" });
      expect(addJobApplication.mock.calls[0][0]).not.toHaveProperty("toolMatch");
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
