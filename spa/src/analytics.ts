import posthog from "posthog-js";

function isLoaded(): boolean {
  return posthog.__loaded;
}

type EventMap = {
  signup_completed: void;
  login_completed: void;
  job_application_created: {
    method: "link_parse" | "manual";
    company?: string;
    position?: string;
  };
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
  resume_match_started: { resumeId: string; jobApplicationId: string };
  resume_match_completed: { resumeId: string; jobApplicationId: string };
  resume_match_failed: { error: string };
  interview_created: { applicationId: string };
  contact_created: { applicationId: string };
  note_created: { applicationId: string };
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
