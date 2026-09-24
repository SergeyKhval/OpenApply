import type { CreateJobApplicationInput, ToolMatch } from "@/types";

// Written by the landing page (astro/src/lib/pendingToolApplication.ts) when a
// visitor clicks "Save and track this job" in the resume match tool, or saves a
// job with the browser extension (/save). Consumed once, right after sign-in.
export const PENDING_TOOL_APPLICATION_KEY = "oa-pending-tool-application";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type PendingToolApplication = {
  version: 1;
  savedAt: string;
  companyName: string;
  position: string;
  jobDescription: string;
  technologies: string[];
  // The posting's URL, when the job came from the browser extension
  jobDescriptionLink?: string;
  // Absent means the match tool
  source?: "extension";
  location?: string;
  // Absent when the extension saved the job without a match check
  match?: Omit<ToolMatch, "checkedAt">;
};

export type PendingApplicationSource = "resume_match_tool" | "extension";

type AddJobApplication = (
  payload: CreateJobApplicationInput,
  options?: { source?: PendingApplicationSource },
) => Promise<{ success: boolean; id?: string }>;

export function pendingApplicationSource(pending: PendingToolApplication): PendingApplicationSource {
  return pending.source === "extension" ? "extension" : "resume_match_tool";
}

function isPendingToolApplication(value: unknown): value is PendingToolApplication {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  const match = candidate.match as Record<string, unknown> | undefined;
  return (
    candidate.version === 1 &&
    typeof candidate.savedAt === "string" &&
    typeof candidate.companyName === "string" &&
    typeof candidate.position === "string" &&
    typeof candidate.jobDescription === "string" &&
    candidate.jobDescription.length > 0 &&
    Array.isArray(candidate.technologies) &&
    (candidate.source === undefined || candidate.source === "extension") &&
    (candidate.location === undefined || typeof candidate.location === "string") &&
    // Only the extension saves a job without a match check
    (match === undefined
      ? candidate.source === "extension"
      : typeof match === "object" &&
        match !== null &&
        typeof match.matchScore === "number" &&
        Array.isArray(match.requirements))
  );
}

function removePending() {
  try {
    localStorage.removeItem(PENDING_TOOL_APPLICATION_KEY);
  } catch {
    // Storage unavailable; nothing to clean up
  }
}

function restorePending(pending: PendingToolApplication) {
  try {
    localStorage.setItem(PENDING_TOOL_APPLICATION_KEY, JSON.stringify(pending));
  } catch {
    // Storage unavailable; the application can't be retried
  }
}

/**
 * Returns the pending tool application if there is a valid, fresh one.
 * Invalid or expired entries are removed.
 */
export function readPendingToolApplication(now = Date.now()): PendingToolApplication | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(PENDING_TOOL_APPLICATION_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      isPendingToolApplication(parsed) &&
      now - new Date(parsed.savedAt).getTime() < MAX_AGE_MS
    ) {
      return parsed;
    }
  } catch {
    // Fall through and drop the corrupt entry
  }
  removePending();
  return null;
}

function isWebUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

function remotePolicyOf(location: string): CreateJobApplicationInput["remotePolicy"] {
  if (/\bhybrid\b/i.test(location)) return "hybrid";
  if (/\bremote\b/i.test(location)) return "remote";
  return undefined;
}

export function toJobApplicationInput(
  pending: PendingToolApplication,
): CreateJobApplicationInput {
  // Applications have no location field: keep it at the top of the description
  const location = pending.location?.trim() ?? "";
  const input: CreateJobApplicationInput = {
    companyName: pending.companyName || "Unknown company",
    position: pending.position || "Unknown position",
    jobDescription: location
      ? `Location: ${location}\n\n${pending.jobDescription}`
      : pending.jobDescription,
    technologies: pending.technologies.slice(0, 10),
  };
  if (pending.match) input.toolMatch = { ...pending.match, checkedAt: pending.savedAt };
  if (isWebUrl(pending.jobDescriptionLink)) input.jobDescriptionLink = pending.jobDescriptionLink;
  const remotePolicy = remotePolicyOf(location);
  if (remotePolicy) input.remotePolicy = remotePolicy;
  return input;
}

export type CreatedPendingApplication = { id: string; source: PendingApplicationSource };

let inFlight: Promise<CreatedPendingApplication | null> | null = null;

// Test hook: forget the shared creation between cases
export function resetPendingToolApplicationState() {
  inFlight = null;
}

/**
 * True when there is a saved tool job to create, or its creation is running.
 */
export function hasPendingToolApplication(): boolean {
  return inFlight !== null || readPendingToolApplication() !== null;
}

/**
 * Creates the job application saved by the landing page and clears it.
 * Every caller in this page load shares one creation, so it happens at most
 * once and late callers still get the same id.
 * Resolves to the new application id and where the job came from, or null if
 * there was nothing to create or creation failed (the entry is kept for a
 * retry in that case).
 */
export function consumePendingToolApplication(
  addJobApplication: AddJobApplication,
): Promise<CreatedPendingApplication | null> {
  if (inFlight) return inFlight;

  const pending = readPendingToolApplication();
  if (!pending) return Promise.resolve(null);

  const source = pendingApplicationSource(pending);
  removePending();
  inFlight = addJobApplication(toJobApplicationInput(pending), { source })
    .then((result) => (result.success && result.id ? { id: result.id, source } : null))
    .catch(() => null)
    .then((created) => {
      if (!created) {
        // Keep the entry so the next sign-in can retry
        restorePending(pending);
        inFlight = null;
      }
      return created;
    });

  return inFlight;
}
