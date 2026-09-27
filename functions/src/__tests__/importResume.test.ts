import { beforeEach, describe, expect, it, vi } from "vitest";

// --- In-memory Firestore: documents by path ---

const store = new Map<string, Record<string, unknown>>();
const writes: { op: "set"; path: string; data: Record<string, unknown> }[] = [];
let autoId = 0;

function snapshot(path: string) {
  const data = store.get(path);
  return { id: path.split("/").at(-1), exists: data !== undefined, data: () => data, get: (field: string) => data?.[field] };
}

function docRef(path: string) {
  return {
    id: path.split("/").at(-1),
    path,
    get: async () => snapshot(path),
    set: async (data: Record<string, unknown>) => {
      writes.push({ op: "set", path, data });
    },
  };
}

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: (name: string) => ({ doc: (id?: string) => docRef(`${name}/${id ?? `auto-${++autoId}`}`) }),
    runTransaction: async (fn: (transaction: unknown) => Promise<unknown>) =>
      fn({
        get: async (ref: { path: string }) => snapshot(ref.path),
        set: (ref: { path: string }, data: Record<string, unknown>) => writes.push({ op: "set", path: ref.path, data }),
      }),
  }),
  FieldValue: { serverTimestamp: () => "mock-ts", increment: (by: number) => ({ increment: by }) },
  Timestamp: { fromMillis: (ms: number) => ({ ms }) },
}));

vi.mock("firebase-functions/v2/https", () => {
  class HttpsError extends Error {
    code: string;
    details?: unknown;
    constructor(code: string, message: string, details?: unknown) {
      super(message);
      this.code = code;
      this.details = details;
    }
  }
  return { HttpsError, onCall: (...args: unknown[]) => args.at(-1) };
});

vi.mock("firebase-functions/params", () => ({ defineString: () => ({ value: () => "" }) }));

const pdfText = vi.fn();
vi.mock("pdf-parse", () => ({
  PDFParse: class {
    getText = async () => ({ text: pdfText() });
    destroy = async () => undefined;
  },
}));

const mockImport = vi.fn();
vi.mock("../lib/importEngine", () => ({
  IMPORT_MODEL: "gemini-3.5-flash",
  IMPORT_PROMPT_VERSION: "import-v1",
  importResumeText: (...args: unknown[]) => mockImport(...args),
}));

import { importResume, MAX_PDF_BYTES } from "../importResume";

const handler = importResume as unknown as (request: { auth?: { uid: string }; data: Record<string, unknown> }) => Promise<{
  resumeId: string;
  fallback: boolean;
  stats: Record<string, unknown>;
}>;

// --- Fixtures ---

const USER_ID = "user-1";
const RESUME_TEXT = "Maya Chen\nmaya@example.com\nExperience\nEngineer, Acme | 2020 – 2024\n• Built a Vue 3 design system used by four teams.";
const STRUCTURED = {
  version: 1,
  contact: { name: "Maya Chen", headline: "", email: "maya@example.com", phone: "", location: "", links: [] },
  sections: [
    {
      id: "s1",
      type: "experience",
      heading: "Experience",
      entries: [
        {
          id: "e1",
          title: "Engineer",
          organization: "Acme",
          location: "",
          start: { year: 2020, month: null },
          end: { year: 2024, month: null },
          bullets: [{ id: "b1", text: "Built a Vue 3 design system used by four teams." }],
        },
      ],
    },
  ],
};
const RESULT = {
  structured: STRUCTURED,
  flaggedFields: ["contact.phone"],
  unsorted: [],
  notImported: ["Interests"],
  stats: { sections: 1, entries: 1, fieldsVerified: 6, fieldsFlagged: 1, bulletsImported: 1, bulletsUnsorted: 0, linesSkipped: 1 },
  fallback: false,
  usage: { inputTokens: 1200, outputTokens: 300, thoughtsTokens: 100 },
};

function seed({ admin = true, resumeOwner = USER_ID, kind = undefined as string | undefined, text = RESUME_TEXT } = {}) {
  store.set(`users/${USER_ID}`, { admin });
  store.set("userResumes/resume-1", { userId: resumeOwner, fileName: "maya.pdf", ...(kind ? { kind } : {}), text });
}

const call = (data: Record<string, unknown> = { source: "resume", resumeId: "resume-1" }, uid: string | null = USER_ID) =>
  handler({ ...(uid ? { auth: { uid } } : {}), data });

const saved = () => writes.filter((write) => write.path.startsWith("userResumes/"));
const counters = () => writes.filter((write) => write.path.startsWith("importRateLimits/"));

describe("importResume", () => {
  beforeEach(() => {
    store.clear();
    writes.length = 0;
    mockImport.mockReset().mockResolvedValue(RESULT);
    pdfText.mockReset().mockReturnValue(RESUME_TEXT);
    delete process.env.BUILDER_ALLOWED_UIDS;
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  describe("access", () => {
    it("requires sign-in", async () => {
      await expect(call(undefined, null)).rejects.toMatchObject({ code: "unauthenticated" });
    });

    it("refuses anyone who isn't an admin or allowlisted, before reading anything else", async () => {
      seed({ admin: false });
      await expect(call()).rejects.toMatchObject({ code: "permission-denied", details: { code: "not_available" } });
      expect(mockImport).not.toHaveBeenCalled();
      expect(writes).toEqual([]);
    });

    it("lets an allowlisted user in", async () => {
      seed({ admin: false });
      process.env.BUILDER_ALLOWED_UIDS = `someone, ${USER_ID}`;
      await expect(call()).resolves.toMatchObject({ resumeId: expect.any(String) });
    });
  });

  describe("sources", () => {
    it("rejects an unknown source", async () => {
      seed();
      await expect(call({ source: "linkedin_url", url: "https://linkedin.com/in/x" })).rejects.toMatchObject({ code: "invalid-argument" });
    });

    it("refuses someone else's resume, a built one, and one with no text", async () => {
      seed({ resumeOwner: "user-2" });
      await expect(call()).rejects.toMatchObject({ code: "permission-denied" });
      seed({ kind: "built" });
      await expect(call()).rejects.toMatchObject({ code: "invalid-argument" });
      seed({ text: "  " });
      await expect(call()).rejects.toMatchObject({ code: "failed-precondition", details: { code: "no_text" } });
      expect(mockImport).not.toHaveBeenCalled();
    });

    it("reads a LinkedIn PDF in memory", async () => {
      seed();
      await call({ source: "linkedin_pdf", pdfBase64: Buffer.from("%PDF-1.4 fake").toString("base64") });
      expect(mockImport).toHaveBeenCalledWith(RESUME_TEXT, "linkedin_pdf");
      expect(saved()[0]!.data).toMatchObject({ title: "LinkedIn profile", importedFrom: { source: "linkedin_pdf" } });
    });

    it("refuses a file that isn't a PDF, or is too big", async () => {
      seed();
      await expect(call({ source: "linkedin_pdf", pdfBase64: Buffer.from("PK zip").toString("base64") })).rejects.toMatchObject({
        details: { code: "not_pdf" },
      });
      const big = Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(MAX_PDF_BYTES)]).toString("base64");
      await expect(call({ source: "linkedin_pdf", pdfBase64: big })).rejects.toMatchObject({ details: { code: "too_big" } });
      expect(mockImport).not.toHaveBeenCalled();
    });

    it("takes pasted text, within limits", async () => {
      seed();
      await call({ source: "linkedin_paste", text: RESUME_TEXT });
      expect(mockImport).toHaveBeenCalledWith(RESUME_TEXT, "linkedin_paste");
      await expect(call({ source: "linkedin_paste", text: "x".repeat(30_001) })).rejects.toMatchObject({ details: { code: "too_long" } });
      await expect(call({ source: "linkedin_paste", text: "Maya Chen" })).rejects.toMatchObject({ details: { code: "too_short" } });
    });
  });

  describe("rate limit", () => {
    it("counts every attempt and stops at the hourly limit", async () => {
      seed();
      await call();
      expect(counters().map((write) => write.data)).toEqual([
        { count: { increment: 1 }, expiresAt: expect.anything() },
        { count: { increment: 1 }, expiresAt: expect.anything() },
        { count: { increment: 1 }, expiresAt: expect.anything() },
      ]);
      const hourly = counters()[0]!.path;
      store.set(hourly, { count: 5 });
      await expect(call()).rejects.toMatchObject({ code: "resource-exhausted" });
    });
  });

  describe("success", () => {
    it("creates a built resume with derived text and what the import couldn't confirm", async () => {
      seed();
      const result = await call();

      expect(result).toEqual({ resumeId: expect.stringMatching(/^auto-/), fallback: false, stats: RESULT.stats });
      const [doc] = saved();
      expect(doc!.path).toBe(`userResumes/${result.resumeId}`);
      expect(doc!.data).toEqual({
        userId: USER_ID,
        kind: "built",
        status: "parsed",
        title: "maya",
        template: "classic",
        structured: STRUCTURED,
        text: "Maya Chen\nmaya@example.com\nExperience\nEngineer, Acme | 2020 – 2024\n• Built a Vue 3 design system used by four teams.",
        importedFrom: {
          source: "resume",
          resumeId: "resume-1",
          flaggedFields: ["contact.phone"],
          unsorted: [],
          notImported: ["Interests"],
          fallback: false,
          model: "gemini-3.5-flash",
          promptVersion: "import-v1",
        },
        createdAt: "mock-ts",
        updatedAt: "mock-ts",
      });
    });

    it("never touches the uploaded resume", async () => {
      seed();
      await call();
      expect(writes.some((write) => write.path === "userResumes/resume-1")).toBe(false);
    });

    it("says so when nothing resume-like came out", async () => {
      seed();
      mockImport.mockResolvedValue({
        ...RESULT,
        structured: { version: 1, contact: { ...STRUCTURED.contact, name: "" }, sections: [] },
        stats: { ...RESULT.stats, sections: 0, entries: 0 },
      });
      await expect(call()).rejects.toMatchObject({ code: "failed-precondition", details: { code: "nothing_found" } });
      expect(saved()).toEqual([]);
    });

    it("logs counts and tokens but never resume text", async () => {
      seed();
      await call();
      const logged = JSON.stringify(vi.mocked(console.log).mock.calls);
      expect(logged).toContain("thoughtsTokens");
      expect(logged).not.toContain("Maya");
      expect(logged).not.toContain("Vue 3");
    });
  });
});
