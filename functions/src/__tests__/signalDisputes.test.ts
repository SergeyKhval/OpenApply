import { beforeEach, describe, expect, it, vi } from "vitest";

// A tiny in-memory Firestore: "collection/id" -> fields
const { store, FakeTimestamp } = vi.hoisted(() => {
  class FakeTimestamp {
    constructor(private readonly ms: number) {}
    toDate() {
      return new Date(this.ms);
    }
  }
  return { store: new Map<string, Record<string, unknown>>(), FakeTimestamp };
});

function snapshot(path: string) {
  const data = store.get(path);
  return { id: path.split("/")[1], exists: Boolean(data), data: () => data, get: (field: string) => data?.[field] };
}

function query(name: string, filters: [string, unknown][] = []) {
  return {
    where: (field: string, _op: string, value: unknown) => query(name, [...filters, [field, value]]),
    get: async () => {
      const docs = [...store.keys()]
        .filter((path) => path.startsWith(`${name}/`))
        .filter((path) => filters.every(([field, value]) => store.get(path)?.[field] === value))
        .map(snapshot);
      return { docs, empty: docs.length === 0 };
    },
  };
}

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: (name: string) => ({
      ...query(name),
      doc: (id: string) => ({
        get: async () => snapshot(`${name}/${id}`),
        update: async (data: Record<string, unknown>) => {
          const path = `${name}/${id}`;
          store.set(path, { ...store.get(path), ...data });
        },
      }),
    }),
  }),
  FieldValue: { serverTimestamp: () => "now" },
  Timestamp: FakeTimestamp,
}));
vi.mock("firebase-functions/v2/https", () => {
  class HttpsError extends Error {
    constructor(public code: string, message: string) {
      super(message);
    }
  }
  return { HttpsError, onCall: (fn: Function) => fn };
});

import { listSignalDisputes, resolveSignalDispute } from "../signalDisputes";

type Call = (request: unknown) => Promise<unknown>;
const as = (uid: string | null, data: unknown = {}) => ({ auth: uid ? { uid } : undefined, data });
const resolve = (data: unknown, uid = "admin") => (resolveSignalDispute as unknown as Call)(as(uid, data));

describe("signal disputes (admin)", () => {
  beforeEach(() => {
    store.clear();
    store.set("users/admin", { admin: true });
    store.set("users/someone", {});
    store.set("jobSignals/h1", { signs: { firstSeenAt: "2026-01-01" }, reports: { no_reply_30d: { days: ["2026-09-01"] } }, reportsHidden: true });
    store.set("jobSignalsPrivate/h1", { link: "https://jobs.lever.co/acme/1", companyTitleKey: "acme|analyst" });
    store.set("signalDisputes/d2", { keyHash: "h1", contactEmail: "b@acme.com", message: "Second", status: "open", createdAt: new FakeTimestamp(Date.UTC(2026, 8, 25)) });
    store.set("signalDisputes/d1", { keyHash: "h1", contactEmail: "a@acme.com", message: "First", status: "open", createdAt: new FakeTimestamp(Date.UTC(2026, 8, 24)) });
    store.set("signalDisputes/d0", { keyHash: "h1", status: "resolved" });
  });

  it("is for admins only", async () => {
    await expect((listSignalDisputes as unknown as Call)(as(null))).rejects.toMatchObject({ code: "permission-denied" });
    await expect((listSignalDisputes as unknown as Call)(as("someone"))).rejects.toMatchObject({ code: "permission-denied" });
    await expect(resolve({ disputeId: "d1", action: "hide" }, "someone")).rejects.toMatchObject({ code: "permission-denied" });
    expect(store.get("jobSignals/h1")?.hidden).toBeUndefined();
  });

  it("lists open requests oldest first, with the posting and what it shows", async () => {
    const { disputes } = (await (listSignalDisputes as unknown as Call)(as("admin"))) as { disputes: { id: string }[] };
    expect(disputes.map((dispute) => dispute.id)).toEqual(["d1", "d2"]);
    expect(disputes[0]).toMatchObject({
      keyHash: "h1",
      contactEmail: "a@acme.com",
      link: "https://jobs.lever.co/acme/1",
      companyTitle: "acme|analyst",
      createdAt: "2026-09-24T00:00:00.000Z",
      signals: { reportsHidden: true, hidden: false, reports: { no_reply_30d: { days: ["2026-09-01"] } } },
    });
  });

  it("keep: reports come back only once no other request on the posting is open", async () => {
    await resolve({ disputeId: "d1", action: "keep", note: "Checked" });
    expect(store.get("signalDisputes/d1")).toMatchObject({ status: "resolved", resolution: "keep", note: "Checked", resolvedBy: "admin" });
    expect(store.get("jobSignals/h1")?.reportsHidden).toBe(true);
    await resolve({ disputeId: "d2", action: "keep" });
    expect(store.get("jobSignals/h1")?.reportsHidden).toBe(false);
  });

  it("hide: the posting shows nothing any more", async () => {
    await resolve({ disputeId: "d1", action: "hide", note: "Employer showed the role is filled" });
    expect(store.get("jobSignals/h1")?.hidden).toBe(true);
  });

  it("resolve: needs a note and changes nothing on the posting", async () => {
    await expect(resolve({ disputeId: "d1", action: "resolve" })).rejects.toMatchObject({ code: "invalid-argument" });
    await resolve({ disputeId: "d1", action: "resolve", note: "Duplicate of d2" });
    expect(store.get("signalDisputes/d1")?.resolution).toBe("resolve");
    expect(store.get("jobSignals/h1")).toMatchObject({ reportsHidden: true });
    expect(store.get("jobSignals/h1")?.hidden).toBeUndefined();
  });

  it("refuses unknown actions and requests already resolved", async () => {
    await expect(resolve({ disputeId: "d1", action: "delete" })).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(resolve({ disputeId: "d0", action: "keep" })).rejects.toMatchObject({ code: "failed-precondition" });
    await expect(resolve({ disputeId: "nope", action: "keep" })).rejects.toMatchObject({ code: "not-found" });
  });
});
