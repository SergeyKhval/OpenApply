import posthog from "posthog-js";

function isLoaded(): boolean {
  return posthog.__loaded;
}

type EventMap = {
  signup_completed: {
    source?: "landing_page_parse" | "resume_match_tool" | "extension" | "direct";
    method?: "password" | "google" | "email_code";
  };
  login_completed: {
    source?: "landing_page_parse" | "resume_match_tool" | "extension" | "direct";
    method?: "password" | "google" | "email_code";
  };
  signup_view_shown: { source?: "landing_page_parse" | "resume_match_tool" | "extension" | "direct" };
  job_application_created: {
    method: "link_parse" | "manual" | "match_tool" | "extension";
    company?: string;
    position?: string;
    source?: "landing_page_parse" | "resume_match_tool" | "extension";
  };
  first_job_application_created: {
    method: "link_parse" | "manual" | "match_tool" | "extension";
    source?: "landing_page_parse" | "resume_match_tool" | "extension";
    minutesSinceSignup?: number;
  };
  lp_job_parse_started: void;
  lp_auth_skipped: void;
  job_parse_succeeded: { company?: string; position?: string };
  job_parse_failed: { error?: string };
  cover_letter_generated: { jobApplicationId: string; resumeId: string };
  cover_letter_generation_failed: { error: string; code?: string };
  cover_letter_regenerated: void;
  resume_uploaded: void;
  resume_upload_failed: { error: string };
  checkout_started: { priceId: string };
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
  follow_up_copied: { applicationId?: string };
  account_deleted: void;
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
