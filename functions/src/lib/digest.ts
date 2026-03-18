import { differenceInDays, subDays } from "date-fns";

export type DigestApplication = {
  id: string;
  companyName: string;
  position: string;
  status: string;
  updatedAt: Date;
  createdAt: Date;
  appliedAt?: Date;
  interviewedAt?: Date;
  offeredAt?: Date;
};

export type DigestInterview = {
  applicationId: string;
  conductedAt: Date;
  // Included to match the Firestore interview document shape queried by the
  // scheduled digest function; not used by categorizeApplications directly.
  status: "pending" | "passed" | "failed";
};

export type ActionItem = {
  applicationId: string;
  companyName: string;
  position: string;
  category: "decision-needed" | "needs-attention" | "follow-up" | "stale-draft" | "consider-archiving";
  daysSinceActivity: number;
};

export type WinItem = {
  companyName: string;
  position: string;
  type: "new-application" | "moved-forward" | "offer-received";
};

export type DigestResult = {
  wins: WinItem[];
  actions: ActionItem[];
  isEmpty: boolean;
};

const FORWARD_STATUSES = ["interviewing", "offered", "hired"];
const SKIP_ACTIONS_STATUSES = ["hired", "rejected", "archived"];

const WINS_WINDOW_DAYS = 7;
const OFFERED_DECISION_THRESHOLD_DAYS = 3;
const INTERVIEWING_ATTENTION_THRESHOLD_DAYS = 5;
const INTERVIEWING_ARCHIVE_THRESHOLD_DAYS = 14;
const APPLIED_FOLLOWUP_THRESHOLD_DAYS = 10;
const APPLIED_ARCHIVE_THRESHOLD_DAYS = 30;
const DRAFT_STALE_THRESHOLD_DAYS = 7;

function getStatusDate(app: DigestApplication): Date {
  switch (app.status) {
    case "offered":
      return app.offeredAt ?? app.updatedAt;
    case "interviewing":
      return app.interviewedAt ?? app.updatedAt;
    case "applied":
      return app.appliedAt ?? app.updatedAt;
    default:
      return app.updatedAt;
  }
}

export function categorizeApplications(
  applications: DigestApplication[],
  interviews: DigestInterview[],
  now: Date,
): DigestResult {
  const actions: ActionItem[] = [];
  const wins: WinItem[] = [];
  const winsWindowStart = subDays(now, WINS_WINDOW_DAYS);

  for (const app of applications) {
    // Use status-specific dates when available, fall back to updatedAt.
    // Status dates reflect when the status actually changed, while updatedAt
    // changes on any edit (description, notes, etc.) which would reset the clock.
    const statusDate = getStatusDate(app);
    const daysSinceStatusChange = differenceInDays(now, statusDate);
    const daysSinceCreation = differenceInDays(now, app.createdAt);
    const appSummary = {
      applicationId: app.id,
      companyName: app.companyName,
      position: app.position,
    };

    // --- Wins (evaluated for all statuses including hired) ---
    if (app.status !== "draft" && app.createdAt >= winsWindowStart) {
      wins.push({ ...appSummary, type: "new-application" });
    }
    // offered is special-cased before the FORWARD_STATUSES check so that a
    // recent offer records "offer-received" rather than the generic "moved-forward".
    if (app.status === "offered" && statusDate >= winsWindowStart) {
      wins.push({ ...appSummary, type: "offer-received" });
    } else if (
      FORWARD_STATUSES.includes(app.status) &&
      statusDate >= winsWindowStart &&
      app.createdAt < winsWindowStart
    ) {
      wins.push({ ...appSummary, type: "moved-forward" });
    }

    // --- Actions (skip terminal statuses) ---
    if (SKIP_ACTIONS_STATUSES.includes(app.status)) continue;

    if (app.status === "offered" && daysSinceStatusChange >= OFFERED_DECISION_THRESHOLD_DAYS) {
      actions.push({ ...appSummary, category: "decision-needed", daysSinceActivity: daysSinceStatusChange });
    } else if (app.status === "interviewing") {
      // TODO: pre-index interviews by applicationId with a Map to avoid O(apps * interviews)
      const appInterviews = interviews.filter((i) => i.applicationId === app.id);
      const hasFutureInterview = appInterviews.some((i) => i.conductedAt > now);

      if (daysSinceStatusChange >= INTERVIEWING_ARCHIVE_THRESHOLD_DAYS) {
        actions.push({ ...appSummary, category: "consider-archiving", daysSinceActivity: daysSinceStatusChange });
      } else if (daysSinceStatusChange >= INTERVIEWING_ATTENTION_THRESHOLD_DAYS && !hasFutureInterview) {
        actions.push({ ...appSummary, category: "needs-attention", daysSinceActivity: daysSinceStatusChange });
      }
    } else if (app.status === "applied") {
      if (daysSinceStatusChange >= APPLIED_ARCHIVE_THRESHOLD_DAYS) {
        actions.push({ ...appSummary, category: "consider-archiving", daysSinceActivity: daysSinceStatusChange });
      } else if (daysSinceStatusChange >= APPLIED_FOLLOWUP_THRESHOLD_DAYS) {
        actions.push({ ...appSummary, category: "follow-up", daysSinceActivity: daysSinceStatusChange });
      }
    } else if (app.status === "draft" && daysSinceCreation >= DRAFT_STALE_THRESHOLD_DAYS) {
      actions.push({ ...appSummary, category: "stale-draft", daysSinceActivity: daysSinceCreation });
    }
  }

  return {
    wins,
    actions,
    isEmpty: wins.length === 0 && actions.length === 0,
  };
}
