import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore } from "firebase-admin/firestore";
import type { PrivateJobSignals } from "./lib/jobSignals";
import { applyListingCheck, listingRequest, listingState, type ListingState } from "./lib/listingCheck";
import { updateJobSignals } from "./jobSignals";

const db = getFirestore();

const USER_AGENT = "OpenApplyBot/1.0 (+https://openapply.app; checks whether jobs people saved are still listed)";
const PER_RUN = 200;
const AT_ONCE = 8;

async function checkListing(signals: PrivateJobSignals, today: string): Promise<ListingState | null> {
  const request = listingRequest(signals.link ?? "", signals.key);
  if (!request) return null;
  try {
    const response = await fetch(request.url, {
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(10000),
    });
    const body = response.status === 200 ? (await response.text()).slice(0, 2_000_000) : "";
    const title = signals.companyTitleKey.split("|")[1] ?? "";
    return listingState(request, response.status, body, title, { today, finalUrl: response.url });
  } catch {
    return "unknown";
  }
}

/** Checks the jobs whose weekly check is due. Returns what it found. */
export async function recheckJobListings(now = Date.now()) {
  const today = new Date(now).toISOString().slice(0, 10);
  const due = await db
    .collection("jobSignalsPrivate")
    .where("listingCheckDueAt", "<=", today)
    .orderBy("listingCheckDueAt")
    .limit(PER_RUN)
    .get();

  const counts = { listed: 0, closed: 0, unknown: 0, uncheckable: 0 };
  for (let start = 0; start < due.docs.length; start += AT_ONCE) {
    await Promise.all(due.docs.slice(start, start + AT_ONCE).map(async (doc) => {
      const state = await checkListing(doc.data() as PrivateJobSignals, today);
      counts[state ?? "uncheckable"]++;
      await updateJobSignals(doc.id, (previous) => {
        const current = previous ?? (doc.data() as PrivateJobSignals);
        if (state) return applyListingCheck(current, state, today);
        // Nothing we can check reliably for this link: stop scheduling it
        const next = { ...current };
        delete next.listingCheckDueAt;
        return next;
      });
    }));
  }
  return counts;
}

// Weekly: which saved jobs are still up, for the "still listed" sign
export const jobListingRecheck = onSchedule(
  { schedule: "every monday 06:00", timeZone: "Etc/UTC", timeoutSeconds: 540 },
  async () => {
    console.log("jobListingRecheck", await recheckJobListings());
  },
);
