import { getFirebaseAuth, getFirebaseFunctions } from "./firebase";

// Starts parsing a job link and returns where the app picks it up: straight to
// the new application form for signed-in users, or signup with the job pending.
// Used by the landing page link input and by /save (the browser extension).
export type JobLinkResult =
  | { ok: true; redirectUrl: string; signedIn: boolean }
  | { ok: false; errorMessage: string };

const spaBase = import.meta.env.PUBLIC_SPA_BASE_URL || "/app";

export async function submitJobLink(url: string): Promise<JobLinkResult> {
  try {
    const auth = await getFirebaseAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      return {
        ok: false,
        errorMessage: "Hmm, we can't reach our servers. Check your internet and give it another shot.",
      };
    }

    // The landing page and the app share an origin, so a signed-in app user shows up here too
    const signedIn = !currentUser.isAnonymous;

    const fns = await getFirebaseFunctions();
    const { httpsCallable } = await import("firebase/functions");
    const callable = httpsCallable<{ url: string }, { id: string }>(fns, "jobs");
    const result = await callable({ url });
    const jobId = result.data.id;

    if (!jobId) {
      return {
        ok: false,
        errorMessage: "Well, that's awkward. We sent the request but got nothing useful back. Try again?",
      };
    }

    const params = new URLSearchParams({ job: jobId, from: "lp" });
    const redirectUrl = signedIn
      ? `${spaBase}/dashboard/applications/new?${params}`
      : `${spaBase}/?${params}`;
    return { ok: true, redirectUrl, signedIn };
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : "";
    if (rawMessage.includes("network") || rawMessage.includes("fetch")) {
      return {
        ok: false,
        errorMessage: "Looks like the internet gremlins got in the way. Check your connection and try again.",
      };
    }
    if (rawMessage.includes("INVALID_ARGUMENT") || rawMessage.includes("invalid")) {
      return {
        ok: false,
        errorMessage: "That URL doesn't look like a job listing we can work with. Double-check the link?",
      };
    }
    return {
      ok: false,
      errorMessage: "Something went sideways on our end. Give it another try. If it keeps happening, this site might just not like us.",
    };
  }
}
