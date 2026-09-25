// Community reports on a posting (oa-dq1 PR 5). Fixed reasons, no free text:
// nothing to moderate, no personal data, no defamation by user text. A reason
// goes public only once THRESHOLD different people used it within
// WINDOW_DAYS. Pure functions; ../jobReports.ts does the Firestore work.

export const REPORT_REASONS = [
  // Only offered when the reporter's own application sat in "applied" 30+ days
  "no_reply_30d",
  "reposted_after_rejection",
  "filled_still_listed",
  // The only red reason: a request for money is a fact the reporter saw
  "asked_for_money",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export function isReportReason(value: unknown): value is ReportReason {
  return typeof value === "string" && (REPORT_REASONS as readonly string[]).includes(value);
}

export type ReportStatus = "active" | "withdrawn" | "removed";

// jobReports/{keyHash}_{uid}: one per user per job, the reason can change
export type JobReport = {
  userId: string;
  keyHash: string;
  applicationId: string;
  reason: ReportReason;
  status: ReportStatus;
  // Normalized company, for the per-company cap
  company: string;
  // YYYY-MM-DD: when the reason was last set
  reportedOn: string;
  createdAt: number;
};

// jobSignals/{keyHash}.reports: only reasons at or over the threshold. Days,
// not reporters, so readers can drop reports that aged out without a rewrite.
export type PublicReports = Partial<Record<ReportReason, { days: string[] }>>;

export const THRESHOLD = 3;
export const WINDOW_DAYS = 180;
export const MIN_ACCOUNT_AGE_DAYS = 7;
export const NO_REPLY_DAYS = 30;
export const DAILY_LIMIT = 5;
export const WEEKLY_LIMIT = 20;
// Anti-brigading: reports on one company by one person
export const COMPANY_LIMIT_30D = 3;

const DAY_MS = 86400000;

export function day(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

export type ReportBlock =
  | "not_signed_in"
  | "email_not_verified"
  | "account_age"
  | "not_saved"
  | "not_eligible_no_reply"
  | "rate_limit"
  | "company_limit";

export type Reporter = {
  emailVerified: boolean;
  anonymous: boolean;
  createdAt: number;
};

export type ReportedApplication = {
  userId: string;
  status: string;
  jobKeyHash?: string;
  appliedAt?: number;
  // Last status change; an "applied" job with no change since appliedAt had no reply
  updatedAt?: number;
  createdAt: number;
};

/** Why this person can't report this job with this reason, or null. */
export function reportBlock(
  uid: string,
  reporter: Reporter,
  application: ReportedApplication | null,
  reason: ReportReason,
  now: number,
): ReportBlock | null {
  if (reporter.anonymous) return "not_signed_in";
  if (!reporter.emailVerified) return "email_not_verified";
  if (now - reporter.createdAt < MIN_ACCOUNT_AGE_DAYS * DAY_MS) return "account_age";
  if (!application || application.userId !== uid || !application.jobKeyHash) return "not_saved";
  if (reason === "no_reply_30d" && !noReplyFor30Days(application, now)) return "not_eligible_no_reply";
  return null;
}

/** The tracker shows the application in "applied" for 30+ days. */
export function noReplyFor30Days(application: Pick<ReportedApplication, "status" | "appliedAt" | "createdAt">, now: number) {
  if (application.status !== "applied") return false;
  const since = application.appliedAt ?? application.createdAt;
  return now - since >= NO_REPLY_DAYS * DAY_MS;
}

/** Rate limits over the reporter's reports of the last 30 days (new reports only). */
export function limitBlock(recent: Pick<JobReport, "createdAt" | "company">[], company: string, now: number): ReportBlock | null {
  const since = (days: number) => recent.filter((report) => now - report.createdAt < days * DAY_MS);
  if (since(1).length >= DAILY_LIMIT || since(7).length >= WEEKLY_LIMIT) return "rate_limit";
  if (company && since(30).filter((report) => report.company === company).length >= COMPANY_LIMIT_30D) {
    return "company_limit";
  }
  return null;
}

/** The public part of a job's reports: reasons with THRESHOLD+ active reports in the window. */
export function publicReports(reports: Pick<JobReport, "reason" | "status" | "reportedOn">[], now: number): PublicReports {
  const from = day(now - WINDOW_DAYS * DAY_MS);
  const byReason: Partial<Record<ReportReason, string[]>> = {};
  for (const report of reports) {
    if (report.status !== "active" || report.reportedOn < from) continue;
    (byReason[report.reason] ??= []).push(report.reportedOn);
  }
  const result: PublicReports = {};
  for (const [reason, days] of Object.entries(byReason) as [ReportReason, string[]][]) {
    if (days.length >= THRESHOLD) result[reason] = { days: days.sort() };
  }
  return result;
}

export const BLOCK_MESSAGES: Record<ReportBlock, string> = {
  not_signed_in: "Sign in to report a posting.",
  email_not_verified: "Verify your email first, then report.",
  account_age: "New accounts can report after their first week.",
  not_saved: "Save the job to your tracker first, then report it.",
  not_eligible_no_reply: "This one is for jobs you applied to 30+ days ago with no reply since.",
  rate_limit: "You've sent a lot of reports lately. Try again tomorrow.",
  company_limit: "You've reported this company three times this month already.",
};
