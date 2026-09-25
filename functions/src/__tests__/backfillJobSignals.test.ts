import { beforeEach, describe, expect, it, vi } from "vitest";

const record = vi.fn();
const update = vi.fn();
const docs: { id: string; data: () => Record<string, unknown>; ref: { update: typeof update } }[] = [];
const userAdmin = vi.fn();
const limitArg = vi.fn();

vi.mock("../jobSignals", () => ({ recordJobSignals: (...args: unknown[]) => record(...args) }));
vi.mock("firebase-admin/firestore", () => {
  const query = {
    orderBy: () => query,
    startAfter: () => query,
    limit: (value: number) => (limitArg(value), query),
    get: async () => ({ docs }),
  };
  return {
    getFirestore: () => ({
      collection: (name: string) =>
        name === "users"
          ? { doc: () => ({ get: async () => ({ get: (field: string) => (field === "admin" ? userAdmin() : undefined) }) }) }
          : { ...query, doc: () => ({ get: async () => ({ exists: true }) }) },
    }),
  };
});
vi.mock("firebase-functions/v2/https", () => {
  class HttpsError extends Error {
    constructor(public code: string, message: string) {
      super(message);
    }
  }
  return { HttpsError, onCall: (_: unknown, fn: Function) => fn };
});

import { backfillJobSignals } from "../backfillJobSignals";

const call = (data: unknown, uid: string | null = "admin-uid") =>
  (backfillJobSignals as unknown as Function)({ data, auth: uid ? { uid } : undefined });

const application = (id: string, fields: Record<string, unknown>) => ({ id, data: () => fields, ref: { update } });

describe("backfillJobSignals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    docs.length = 0;
    userAdmin.mockReturnValue(true);
    record.mockResolvedValue("hash-1");
  });

  it("is for admins only", async () => {
    await expect(call({}, null)).rejects.toThrow("Admins only");
    userAdmin.mockReturnValue(undefined);
    await expect(call({})).rejects.toThrow("Admins only");
  });

  it("dry run by default: counts, writes nothing", async () => {
    docs.push(
      application("a", { jobDescriptionLink: "https://jobs.lever.co/acme/1" }),
      application("b", { jobDescriptionLink: "https://jobs.lever.co/acme/2", jobKeyHash: "done" }),
      application("c", { companyName: "No link" }),
    );
    await expect(call({})).resolves.toEqual({ dryRun: true, scanned: 3, eligible: 1, recorded: 0, nextCursor: null });
    expect(record).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("records eligible applications and stores their key hash", async () => {
    docs.push(application("a", { jobDescriptionLink: "https://jobs.lever.co/acme/1" }));
    await expect(call({ dryRun: false })).resolves.toMatchObject({ dryRun: false, eligible: 1, recorded: 1 });
    expect(record).toHaveBeenCalledWith({ jobDescriptionLink: "https://jobs.lever.co/acme/1" });
    expect(update).toHaveBeenCalledWith({ jobKeyHash: "hash-1" });
  });

  it("reads 50 per page by default and never more than 100", async () => {
    await call({});
    expect(limitArg).toHaveBeenLastCalledWith(50);
    await call({ limit: 500 });
    expect(limitArg).toHaveBeenLastCalledWith(100);
    await call({ limit: 30 });
    expect(limitArg).toHaveBeenLastCalledWith(30);
  });

  it("returns no cursor when the page isn't full", async () => {
    await expect(call({ limit: 50 })).resolves.toMatchObject({ scanned: 0, nextCursor: null });
  });
});
