import { differenceInDays, subDays } from "date-fns";

export type DigestApplication = {
  id: string;
  companyName: string;
  position: string;
  status: string;
  updatedAt: Date;
  createdAt: Date;
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

export function categorizeApplications(
  applications: DigestApplication[],
  interviews: DigestInterview[],
  now: Date,
): DigestResult {
  const actions: ActionItem[] = [];
  const wins: WinItem[] = [];
  const sevenDaysAgo = subDays(now, 7);

  for (const app of applications) {
    const daysSinceUpdate = differenceInDays(now, app.updatedAt);
    const daysSinceCreation = differenceInDays(now, app.createdAt);
    const appSummary = {
      applicationId: app.id,
      companyName: app.companyName,
      position: app.position,
    };

    // --- Wins (evaluated for all statuses including hired) ---
    if (app.status !== "draft" && app.createdAt >= sevenDaysAgo) {
      wins.push({ ...appSummary, type: "new-application" });
    }
    // offered is special-cased before the FORWARD_STATUSES check so that a
    // recent offer records "offer-received" rather than the generic "moved-forward".
    if (app.status === "offered" && app.updatedAt >= sevenDaysAgo) {
      wins.push({ ...appSummary, type: "offer-received" });
    } else if (
      FORWARD_STATUSES.includes(app.status) &&
      app.updatedAt >= sevenDaysAgo &&
      app.createdAt < sevenDaysAgo
    ) {
      wins.push({ ...appSummary, type: "moved-forward" });
    }

    // --- Actions (skip terminal statuses) ---
    if (SKIP_ACTIONS_STATUSES.includes(app.status)) continue;

    if (app.status === "offered" && daysSinceUpdate >= 3) {
      actions.push({ ...appSummary, category: "decision-needed", daysSinceActivity: daysSinceUpdate });
    } else if (app.status === "interviewing") {
      const appInterviews = interviews.filter((i) => i.applicationId === app.id);
      const hasFutureInterview = appInterviews.some((i) => i.conductedAt > now);

      if (daysSinceUpdate >= 14) {
        actions.push({ ...appSummary, category: "consider-archiving", daysSinceActivity: daysSinceUpdate });
      } else if (daysSinceUpdate >= 5 && !hasFutureInterview) {
        actions.push({ ...appSummary, category: "needs-attention", daysSinceActivity: daysSinceUpdate });
      }
    } else if (app.status === "applied") {
      if (daysSinceUpdate >= 30) {
        actions.push({ ...appSummary, category: "consider-archiving", daysSinceActivity: daysSinceUpdate });
      } else if (daysSinceUpdate >= 10) {
        actions.push({ ...appSummary, category: "follow-up", daysSinceActivity: daysSinceUpdate });
      }
    } else if (app.status === "draft" && daysSinceCreation >= 7) {
      actions.push({ ...appSummary, category: "stale-draft", daysSinceActivity: daysSinceCreation });
    }
  }

  return {
    wins,
    actions,
    isEmpty: wins.length === 0 && actions.length === 0,
  };
}
