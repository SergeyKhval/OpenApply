import posthog from "posthog-js";
import type { BlockedJobBoard } from "@/lib/jobInput";
import type { FollowUpTemplateType } from "@/types";

function isLoaded(): boolean {
  return posthog.__loaded;
}

export type AiLimitSource = "cover_letter" | "ai_review" | "regenerate_cover_letter" | "settings_plan";

type JobCreationMethod = "link_parse" | "paste" | "manual" | "match_tool" | "extension";
// "landing" events come from astro/src/components/vue/JobLinkInput.vue
export type JobInputSurface = "landing" | "first_run" | "add_dialog";

type EventMap = {
  signup_completed: {
    source?: "landing_page_parse" | "resume_match_tool" | "extension" | "direct";
    method?: "google" | "email_code";
  };
  login_completed: {
    source?: "landing_page_parse" | "resume_match_tool" | "extension" | "direct";
    method?: "google" | "email_code";
  };
  signup_view_shown: { source?: "landing_page_parse" | "resume_match_tool" | "extension" | "direct" };
  job_application_created: {
    method: JobCreationMethod;
    company?: string;
    position?: string;
    source?: "landing_page_parse" | "resume_match_tool" | "extension";
  };
  first_job_application_created: {
    method: JobCreationMethod;
    source?: "landing_page_parse" | "resume_match_tool" | "extension";
    minutesSinceSignup?: number;
  };
  lp_job_parse_started: void;
  // The job input got a link or a pasted description
  job_input_submitted: { input: "link" | "text"; surface: JobInputSurface; board?: BlockedJobBoard };
  // A LinkedIn/Indeed link skipped the scrape and asked for the description
  job_board_shortcut_shown: { board: BlockedJobBoard; surface: JobInputSurface };
  lp_auth_skipped: void;
  job_parse_succeeded: { company?: string; position?: string };
  job_parse_failed: { error?: string };
  cover_letter_generated: { jobApplicationId: string; resumeId: string };
  cover_letter_generation_failed: { error: string; code?: string };
  cover_letter_regenerated: void;
  resume_uploaded: void;
  resume_upload_failed: { error: string };
  checkout_started: { plan: "pro"; source: AiLimitSource };
  ai_limit_reached: { plan: "free" | "pro"; source: AiLimitSource };
  upgrade_clicked: { source: AiLimitSource };
  billing_portal_opened: void;
  status_changed: { applicationId: string; status: string };
  csv_import_completed: { rowCount: number };
  jobs_exported: { rowCount: number };
  extension_install_clicked: { from: "first_run" };
  resume_match_started: { resumeId: string; jobApplicationId: string };
  resume_match_completed: { resumeId: string; jobApplicationId: string };
  resume_match_failed: { error: string };
  interview_created: { applicationId: string };
  contact_created: { applicationId: string };
  note_created: { applicationId: string };
  next_up_action: { kind: "follow-up" | "interview" | "stale-saved"; action: "draft" | "done" | "snooze" | "applied" | "let_go" | "open" };
  follow_up_copied: { applicationId?: string; template: FollowUpTemplateType };
  account_deleted: void;
  // Posting signals (flag job-signals) were on screen
  job_signals_shown: { surface: "app_page"; sign_types: string[] };
  // Opened "What these mean"
  job_signals_explained: { surface: "app_page" };
  // Reports on a posting (flag job-signals)
  job_report_started: { surface: "app_page" };
  job_report_submitted: { reason: string; surface: "app_page" | "no_reply_prompt" };
  job_report_blocked: { cause: string };
  job_report_withdrawn: { reason: string };
  signal_dispute_submitted: void;
};

type EventName = keyof EventMap;
type VoidEvent = { [K in EventName]: EventMap[K] extends void ? K : never }[EventName];
type PropsEvent = Exclude<EventName, VoidEvent>;

export function identifyUser(
  uid: string,
  properties: { email?: string | null; authMethod: string },
) {
  if (!isLoaded()) return;
  posthog.identify(uid, properties);
}

export function resetUser() {
  if (!isLoaded()) return;
  posthog.reset();
}

export function trackEvent(name: VoidEvent): void;
export function trackEvent<E extends PropsEvent>(name: E, properties: EventMap[E]): void;
export function trackEvent(name: EventName, properties?: Record<string, unknown>) {
  if (!isLoaded()) return;
  posthog.capture(name, properties);
}

export function capturePageview() {
  if (!isLoaded()) return;
  posthog.capture("$pageview");
}
