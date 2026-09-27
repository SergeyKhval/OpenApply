import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";
import { PDFParse } from "pdf-parse";
import { validateResourceOwnership } from "./lib/ownership";
import { rateLimitWindows } from "./lib/matchTool";
import { assertBuilderAllowed, assertImportWithinLimits } from "./lib/builderAccess";
import { IMPORT_MODEL, IMPORT_PROMPT_VERSION, importResumeText, type ImportSource } from "./lib/importEngine";
import { serializeResume } from "./lib/builtResume";

defineString("GEMINI_API_KEY");

const db = getFirestore();

const RATE_LIMIT_TTL_MS = 2 * 24 * 60 * 60 * 1000;
export const MAX_PDF_BYTES = 5 * 1024 * 1024;
export const MAX_PASTE_CHARS = 30_000;
export const MIN_TEXT_CHARS = 50;
const MAX_TITLE_CHARS = 120;

async function consumeImportRateLimit(userId: string) {
  const now = new Date();
  const windows = rateLimitWindows(userId, now);
  const refs = {
    hourly: db.collection("importRateLimits").doc(windows.hourly),
    daily: db.collection("importRateLimits").doc(windows.daily),
    global: db.collection("importRateLimits").doc(windows.global),
  };
  const expiresAt = Timestamp.fromMillis(now.getTime() + RATE_LIMIT_TTL_MS);

  await db.runTransaction(async (transaction) => {
    const [hourly, daily, global] = await Promise.all([
      transaction.get(refs.hourly),
      transaction.get(refs.daily),
      transaction.get(refs.global),
    ]);
    assertImportWithinLimits({
      hourly: hourly.data()?.count ?? 0,
      daily: daily.data()?.count ?? 0,
      global: global.data()?.count ?? 0,
    });
    for (const ref of Object.values(refs)) {
      transaction.set(ref, { count: FieldValue.increment(1), expiresAt }, { merge: true });
    }
  });
}

type SourceText = { text: string; title: string; resumeId?: string };

async function readSource(userId: string, data: Record<string, unknown>): Promise<SourceText> {
  const { source } = data;
  if (source === "resume") {
    const { resumeId } = data;
    if (typeof resumeId !== "string" || !resumeId) {
      throw new HttpsError("invalid-argument", "resumeId is required");
    }
    const resume = await db.collection("userResumes").doc(resumeId).get();
    const resumeData = resume.data();
    if (!resumeData) throw new HttpsError("not-found", "Resume not found");
    validateResourceOwnership(resumeData as { userId: string }, userId);
    if (resumeData.kind === "built") {
      throw new HttpsError("invalid-argument", "This resume is already editable.");
    }
    if (typeof resumeData.text !== "string" || !resumeData.text.trim()) {
      throw new HttpsError("failed-precondition", "We couldn't read the text in this PDF, so there's nothing to copy.", {
        code: "no_text",
      });
    }
    const fileName = typeof resumeData.fileName === "string" ? resumeData.fileName.replace(/\.pdf$/i, "") : "";
    return { text: resumeData.text, title: fileName || "Resume", resumeId };
  }

  if (source === "linkedin_pdf") {
    const { pdfBase64 } = data;
    if (typeof pdfBase64 !== "string" || !pdfBase64) {
      throw new HttpsError("invalid-argument", "pdfBase64 is required");
    }
    const buffer = Buffer.from(pdfBase64, "base64");
    if (buffer.length > MAX_PDF_BYTES) {
      throw new HttpsError("invalid-argument", "That PDF is too big. LinkedIn's own export is well under 5 MB.", { code: "too_big" });
    }
    if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
      throw new HttpsError("invalid-argument", "That file isn't a PDF.", { code: "not_pdf" });
    }
    // Parsed in memory, never stored
    let text: string;
    try {
      const parser = new PDFParse({ data: buffer });
      text = (await parser.getText()).text;
      await parser.destroy();
    } catch {
      throw new HttpsError("invalid-argument", "We couldn't read that PDF. Try exporting it from LinkedIn again.", { code: "unreadable" });
    }
    return { text, title: "LinkedIn profile" };
  }

  if (source === "linkedin_paste") {
    const { text } = data;
    if (typeof text !== "string") throw new HttpsError("invalid-argument", "text is required");
    if (text.length > MAX_PASTE_CHARS) {
      throw new HttpsError("invalid-argument", "That's more text than a profile has. Copy from your name down to Education.", {
        code: "too_long",
      });
    }
    return { text, title: "LinkedIn profile" };
  }

  throw new HttpsError("invalid-argument", "source must be resume, linkedin_pdf or linkedin_paste");
}

/**
 * Starts a built resume from an uploaded resume's text, a LinkedIn "Save to
 * PDF" export or pasted profile text. The model only maps lines to fields;
 * importVerify keeps what the source says. Free (no AI check), rate limited.
 * Creates the userResumes doc and returns its id.
 */
export const importResume = onCall({ memory: "512MiB", timeoutSeconds: 120 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }
  const userId = request.auth.uid;
  const data = (request.data ?? {}) as Record<string, unknown>;

  try {
    // Closed until rollout: the app's flag only hides the entry points
    const user = await db.collection("users").doc(userId).get();
    assertBuilderAllowed(userId, user.get("admin") === true);

    const source = data.source as ImportSource;
    const { text, title, resumeId } = await readSource(userId, data);
    if (text.replace(/\s+/g, "").length < MIN_TEXT_CHARS) {
      throw new HttpsError("failed-precondition", "There's too little text here to build a resume from.", { code: "too_short" });
    }

    await consumeImportRateLimit(userId);

    const started = Date.now();
    const result = await importResumeText(text, source);
    // Counts and tokens only, never resume text
    console.log("importResume", { source, fallback: result.fallback, ...result.stats, usage: result.usage, durationMs: Date.now() - started });

    if (!result.structured.contact.name && result.stats.entries === 0 && result.stats.sections === 0) {
      throw new HttpsError("failed-precondition", "We couldn't find a resume in that text. Try another file, or start from scratch.", {
        code: "nothing_found",
      });
    }

    const ref = db.collection("userResumes").doc();
    await ref.set({
      userId,
      kind: "built",
      status: "parsed",
      title: title.slice(0, MAX_TITLE_CHARS),
      template: "classic",
      structured: result.structured,
      text: serializeResume(result.structured),
      importedFrom: {
        source,
        ...(resumeId ? { resumeId } : {}),
        flaggedFields: result.flaggedFields,
        unsorted: result.unsorted,
        notImported: result.notImported,
        fallback: result.fallback,
        model: IMPORT_MODEL,
        promptVersion: IMPORT_PROMPT_VERSION,
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { resumeId: ref.id, fallback: result.fallback, stats: result.stats };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error("Error importing resume:", error instanceof Error ? error.message : error);
    throw new HttpsError("internal", "Something went wrong while importing. Try again in a moment.");
  }
});
