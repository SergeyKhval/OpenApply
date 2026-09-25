import { beforeEach, describe, expect, it, vi } from "vitest";

// A tiny in-memory Firestore: "collection/id" -> fields
const { store, sent, FakeTimestamp, authUser } = vi.hoisted(() => {
  class FakeTimestamp {
    constructor(private readonly ms: number) {}
    toMillis() {
      return this.ms;
    }
    static fromMillis(ms: number) {
      return new FakeTimestamp(ms);
    }
  }
  return {
    store: new Map<string, Record<string, unknown>>(),
    sent: vi.fn(),
    FakeTimestamp,
    authUser: { emailVerified: true, metadata: { creationTime: new Date(Date.now() - 30 * 86400000).toUTCString() } },
  };
});

function docRef(path: string) {
  return {
    id: path.split("/")[1],
    get: async () => snapshot(path),
    set: async (data: Record<string, unknown>) => {
      const previous = store.get(path) ?? {};
      const next = Object.fromEntries(
        Object.entries(data).map(([field, value]) => {
          const increment = (value as { increment?: number } | null)?.increment;
          return [field, increment === undefined ? value : ((previous[field] as number) ?? 0) + increment];
        }),
      );
      store.set(path, next);
    },
    update: async (data: Record<string, unknown>) => {
      if (!store.has(path)) throw new Error(`no doc ${path}`);
      store.set(path, { ...store.get(path), ...data });
    },
  };
}

function snapshot(path: string) {
  const data = store.get(path);
  return { exists: Boolean(data), data: () => data, get: (field: string) => data?.[field] };
}

function query(name: string, filters: [string, string, unknown][] = []) {
  return {
    where: (field: string, op: string, value: unknown) => query(name, [...filters, [field, op, value]]),
    orderBy: () => query(name, filters),
    get: async () => ({
      docs: [...store.entries()]
        .filter(([path]) => path.startsWith(`${name}/`))
        .filter(([, data]) =>
          filters.every(([field, op, value]) =>
            op === "==" ? data[field] === value : (data[field] as number) >= (value as number),
          ),
        )
        .map(([path, data]) => ({ id: path, data: () => data, get: (field: string) => data[field] })),
    }),
  };
}

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: (name: string) => ({
      ...query(name),
      doc: (id: string) => docRef(`${name}/${id}`),
      add: async (data: Record<string, unknown>) => {
        const id = `d${store.size}`;
        store.set(`${name}/${id}`, data);
        return { id };
      },
    }),
    runTransaction: async (fn: (transaction: unknown) => Promise<void>) =>
      fn({
        get: (ref: ReturnType<typeof docRef>) => ref.get(),
        set: (ref: ReturnType<typeof docRef>, data: Record<string, unknown>) => ref.set(data),
      }),
  }),
  FieldValue: { increment: (by: number) => ({ increment: by }), serverTimestamp: () => "now" },
  Timestamp: FakeTimestamp,
}));

vi.mock("firebase-admin/auth", () => ({ getAuth: () => ({ getUser: async () => authUser }) }));
vi.mock("firebase-functions", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
vi.mock("firebase-functions/params", () => ({ defineString: () => ({ value: () => "re_test" }) }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sent };
  },
}));
vi.mock("firebase-functions/v2/https", () => {
  class HttpsError extends Error {
    constructor(public code: string, message: string, public details?: unknown) {
      super(message);
    }
  }
  return { HttpsError, onCall: (fn: Function) => fn };
});

import { reportJob, submitSignalDispute, withdrawJobReport } from "../jobReports";

type Call = (request: unknown) => Promise<unknown>;
const HASH = "a".repeat(64);
const as = (uid: string | null, data: unknown) => ({
  auth: uid ? { uid, token: { firebase: { sign_in_provider: "google.com" } } } : undefined,
  data,
  rawRequest: { headers: {}, ip: "203.0.113.9" },
});

function saveApplication(uid: string, status = "applied", appliedDaysAgo = 40) {
  store.set(`jobApplications/app-${uid}`, {
    userId: uid,
    status,
    companyName: "Acme GmbH",
    jobKeyHash: HASH,
    appliedAt: FakeTimestamp.fromMillis(Date.now() - appliedDaysAgo * 86400000),
    createdAt: FakeTimestamp.fromMillis(Date.now() - 50 * 86400000),
  });
}

const report = (uid: string, reason: string) =>
  (reportJob as unknown as Call)(as(uid, { applicationId: `app-${uid}`, reason }));

describe("reportJob", () => {
  beforeEach(() => {
    store.clear();
    sent.mockReset();
    authUser.emailVerified = true;
    store.set(`jobSignals/${HASH}`, { signs: { firstSeenAt: "2026-01-01" } });
  });

  it("keeps a reason private until three people used it", async () => {
    for (const uid of ["u1", "u2"]) {
      saveApplication(uid);
      await report(uid, "no_reply_30d");
    }
    expect(store.get(`jobSignals/${HASH}`)?.reports).toEqual({});
    saveApplication("u3");
    await report("u3", "no_reply_30d");
    const reports = store.get(`jobSignals/${HASH}`)?.reports as Record<string, { days: string[] }>;
    expect(reports.no_reply_30d.days).toHaveLength(3);
    expect(store.get(`jobReports/${HASH}_u1`)).toMatchObject({ userId: "u1", status: "active", company: "acme gmbh" });
  });

  it("keeps one report per person per job: a second one changes the reason", async () => {
    saveApplication("u1");
    await report("u1", "no_reply_30d");
    await report("u1", "asked_for_money");
    expect([...store.keys()].filter((path) => path.startsWith("jobReports/"))).toEqual([`jobReports/${HASH}_u1`]);
    expect(store.get(`jobReports/${HASH}_u1`)?.reason).toBe("asked_for_money");
  });

  it("refuses without a saved job, a verified email, or a real reason", async () => {
    await expect(report("u1", "asked_for_money")).rejects.toMatchObject({ details: { block: "not_saved" } });
    saveApplication("u1");
    await expect(report("u1", "scam")).rejects.toMatchObject({ code: "invalid-argument" });
    authUser.emailVerified = false;
    await expect(report("u1", "asked_for_money")).rejects.toMatchObject({ details: { block: "email_not_verified" } });
    await expect((reportJob as unknown as Call)(as(null, {}))).rejects.toMatchObject({ details: { block: "not_signed_in" } });
  });

  it("offers no reply only after 30 days in applied", async () => {
    saveApplication("u1", "applied", 10);
    await expect(report("u1", "no_reply_30d")).rejects.toMatchObject({ details: { block: "not_eligible_no_reply" } });
  });

  it("withdrawing takes the report out of the public count", async () => {
    for (const uid of ["u1", "u2", "u3"]) {
      saveApplication(uid);
      await report(uid, "asked_for_money");
    }
    await (withdrawJobReport as unknown as Call)(as("u2", { keyHash: HASH }));
    expect(store.get(`jobReports/${HASH}_u2`)?.status).toBe("withdrawn");
    expect(store.get(`jobSignals/${HASH}`)?.reports).toEqual({});
  });
});

describe("submitSignalDispute", () => {
  const dispute = (data: unknown) => (submitSignalDispute as unknown as Call)(as(null, data));

  beforeEach(() => {
    store.clear();
    sent.mockReset();
    store.set(`jobSignals/${HASH}`, { signs: { firstSeenAt: "2026-01-01" } });
  });

  it("stores the request, hides the reports and emails the admin", async () => {
    await expect(dispute({ keyHash: HASH, email: "hr@acme.com", message: "Role is open and hiring." })).resolves.toEqual({
      received: true,
    });
    expect(store.get(`jobSignals/${HASH}`)?.reportsHidden).toBe(true);
    const saved = [...store.entries()].find(([path]) => path.startsWith("signalDisputes/"))?.[1];
    expect(saved).toMatchObject({ keyHash: HASH, contactEmail: "hr@acme.com", status: "open" });
    expect(sent).toHaveBeenCalledWith(expect.objectContaining({ replyTo: "hr@acme.com" }));
  });

  it("checks the fields", async () => {
    await expect(dispute({ keyHash: "nope", email: "hr@acme.com", message: "x" })).rejects.toMatchObject({
      code: "invalid-argument",
    });
    await expect(dispute({ keyHash: HASH, email: "not an email", message: "x" })).rejects.toMatchObject({
      code: "invalid-argument",
    });
    await expect(dispute({ keyHash: HASH, email: "hr@acme.com", message: "x".repeat(1001) })).rejects.toMatchObject({
      code: "invalid-argument",
    });
    await expect(dispute({ keyHash: "b".repeat(64), email: "hr@acme.com", message: "x" })).rejects.toMatchObject({
      code: "not-found",
    });
  });

  it("takes at most 3 a day from one address", async () => {
    for (let count = 0; count < 3; count++) await dispute({ keyHash: HASH, email: "hr@acme.com", message: "Hi" });
    await expect(dispute({ keyHash: HASH, email: "hr@acme.com", message: "Hi" })).rejects.toMatchObject({
      code: "resource-exhausted",
    });
  });
});
