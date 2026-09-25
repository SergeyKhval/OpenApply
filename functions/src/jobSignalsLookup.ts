import { onRequest } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

const db = getFirestore();

// A bucket holds every job whose key hash starts with these 4 hex characters
// (65,536 buckets); more than this many would be a surprise at our size
const MAX_BUCKET = 50;

/** The public fields of one signals doc, or null when the admin hid it. */
export function bucketEntry(hash: string, data: Record<string, unknown>) {
  if (data.hidden === true) return null;
  return {
    hash,
    signs: data.signs ?? null,
    reports: data.reportsHidden === true ? null : (data.reports ?? null),
  };
}

// The extension popup looks a job up without saying which one (k-anonymity,
// like HIBP): it sends the first 4 hex characters of the job key hash, gets
// the whole bucket and matches the full hash itself. Nothing is logged about
// the request. CORS is open so the popup needs no host permission.
export const jobSignalsLookup = onRequest(
  { cors: true, maxInstances: 5, concurrency: 80, memory: "256MiB", timeoutSeconds: 10 },
  async (req, res) => {
    if (req.method !== "GET") {
      res.status(405).send("GET only");
      return;
    }
    const prefix = typeof req.query.p === "string" ? req.query.p : "";
    if (!/^[0-9a-f]{4}$/.test(prefix)) {
      res.status(400).json({ error: "p must be 4 lowercase hex characters" });
      return;
    }
    const { docs } = await db.collection("jobSignals").where("keyPrefix", "==", prefix).limit(MAX_BUCKET).get();
    const entries = docs.map((doc) => bucketEntry(doc.id, doc.data())).filter(Boolean);
    res.set("Cache-Control", "public, max-age=300");
    res.json({ entries });
  },
);
