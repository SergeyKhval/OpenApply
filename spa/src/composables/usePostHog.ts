import posthog from "posthog-js";

export function usePostHog(apiKey: string, api_host: string) {
  posthog.init(apiKey, {
    api_host,
    defaults: "2025-05-24",
    person_profiles: "always",
    capture_exceptions: true,
  });

  return { posthog };
}
