import { getFirebaseAuth, getFirebaseFunctions } from "./firebase";

// Starts parsing a job link, or a pasted job description, and returns where the
// app picks it up: straight to the new application form for signed-in users,
// or signup with the job pending. Used by the landing page job input and by
// /save (the browser extension).
export type JobLinkResult =
  | { ok: true; redirectUrl: string; signedIn: boolean }
  | { ok: false; errorMessage: string };

const spaBase = import.meta.env.PUBLIC_SPA_BASE_URL || "/app";

// A link to scrape, or a pasted description with the posting's link if known
type JobRequest = { url: string } | { text: string; url?: string };

export function submitJobLink(url: string): Promise<JobLinkResult> {
  return submitJob({ url });
}

export function submitJobDescription(text: string, url?: string | null): Promise<JobLinkResult> {
  return submitJob(url ? { text, url } : { text });
}

async function submitJob(request: JobRequest): Promise<JobLinkResult> {
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
    const callable = httpsCallable<JobRequest, { id: string }>(fns, "jobs");
    const result = await callable(request);
    const jobId = result.data.id;

    if (!jobId) {
      return {
        ok: false,
        errorMessage: "Well, that's awkward. We sent the request but got nothing useful back. Try again?",
      };
    }

    const params = new URLSearchParams({ job: jobId, from: "lp" });
    const redirectUrl = signedIn
      ? `${spaBase}/jobs/new?${params}`
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
    const code = (err as { code?: string })?.code ?? "";
    // The server's own wording for a pasted description that's too short or too long
    if ("text" in request && code === "functions/invalid-argument" && rawMessage) {
      return { ok: false, errorMessage: rawMessage };
    }
    // The server's own wording for a rate limit: it already names the specific limit
    if (code === "functions/resource-exhausted" && rawMessage) {
      return { ok: false, errorMessage: rawMessage };
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
