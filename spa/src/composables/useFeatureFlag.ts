import { readonly, ref, type Ref } from "vue";
import posthog from "posthog-js";

// Flags forced on for this build, e.g. VITE_FEATURE_FLAGS=job-signals in a
// local .env, so a flagged feature can be tried without PostHog
const forced = new Set(
  (import.meta.env.VITE_FEATURE_FLAGS ?? "")
    .split(",")
    .map((flag: string) => flag.trim())
    .filter(Boolean),
);

const flags = new Map<string, Ref<boolean>>();

/** Whether a PostHog feature flag is on for this user; updates when flags load. */
export function useFeatureFlag(flag: string): Readonly<Ref<boolean>> {
  let enabled = flags.get(flag);
  if (!enabled) {
    const state = ref(forced.has(flag));
    enabled = state;
    flags.set(flag, state);
    if (!state.value && posthog.__loaded) {
      // One listener per flag for the whole app; it also fires once flags are cached
      posthog.onFeatureFlags(() => {
        state.value = posthog.isFeatureEnabled(flag) === true;
      });
    }
  }
  return readonly(enabled);
}
