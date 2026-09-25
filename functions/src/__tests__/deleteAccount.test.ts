import { beforeEach, describe, expect, it, vi } from "vitest";

// A tiny in-memory Firestore: collection name -> docs (id + userId)
let store: Record<string, { id: string; userId: string; keyHash?: string }[]>;
let billingStatus: string | undefined;
const deletedDocs: string[] = [];
const recursiveDeletes: string[] = [];
const events: string[] = [];

const mockDeleteFiles = vi.fn(async () => {
  events.push("storage");
});
const mockDeleteUser = vi.fn(async () => {
  events.push("auth");
});

function queryFor(name: string, uid: string, limit = Infinity) {
  return {
    limit: (count: number) => queryFor(name, uid, count),
    get: async () => {
      const docs = (store[name] ?? []).filter((doc) => doc.userId === uid).slice(0, limit);
      return {
        empty: docs.length === 0,
        size: docs.length,
        docs: docs.map((doc) => ({
          ref: { path: `${name}/${doc.id}`, collection: name, id: doc.id },
          get: (field: string) => doc[field as keyof typeof doc],
        })),
      };
    },
  };
}

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: (name: string) => ({
      where: (_field: string, _op: string, uid: string) => queryFor(name, uid),
      doc: (id: string) => ({
        path: `${name}/${id}`,
        collection: () => ({
          doc: () => ({
            get: async () => ({
              exists: billingStatus !== undefined,
              data: () => ({ subscriptionStatus: billingStatus }),
            }),
          }),
        }),
      }),
    }),
    batch: () => {
      const refs: { path: string; collection: string; id: string }[] = [];
      return {
        delete: (ref: { path: string; collection: string; id: string }) => refs.push(ref),
        commit: async () => {
          for (const ref of refs) {
            store[ref.collection] = store[ref.collection].filter((doc) => doc.id !== ref.id);
            deletedDocs.push(ref.path);
          }
          events.push("firestore");
        },
      };
    },
    recursiveDelete: async (ref: { path: string }) => {
      recursiveDeletes.push(ref.path);
      events.push("profile");
    },
  }),
}));

const mockRefreshPublicReports = vi.fn();
vi.mock("../jobReports", () => ({ refreshPublicReports: (...args: unknown[]) => mockRefreshPublicReports(...args) }));

vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({ bucket: () => ({ deleteFiles: mockDeleteFiles }) }),
}));

vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({ deleteUser: mockDeleteUser }),
}));

vi.mock("firebase-functions", () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

vi.mock("firebase-functions/v2/https", () => ({
  onCall: (_options: unknown, fn: (request: unknown) => unknown) => fn,
  HttpsError: class HttpsError extends Error {
    constructor(public code: string, message: string) {
      super(message);
    }
  },
}));

import { deleteAccount, USER_DATA_COLLECTIONS } from "../deleteAccount";

const call = deleteAccount as unknown as (request: unknown) => Promise<unknown>;
const signedIn = (data: unknown, provider = "google.com") => ({
  auth: { uid: "user-1", token: { firebase: { sign_in_provider: provider } } },
  data,
});

describe("deleteAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deletedDocs.length = 0;
    recursiveDeletes.length = 0;
    events.length = 0;
    billingStatus = undefined;
    store = Object.fromEntries(
      USER_DATA_COLLECTIONS.map((name) => [
        name,
        [
          { id: `${name}-mine`, userId: "user-1" },
          { id: `${name}-theirs`, userId: "user-2" },
        ],
      ]),
    );
    store.jobs = [{ id: "shared-job", userId: "user-1" }];
    store.jobReports = [
      { id: "h1_user-1", userId: "user-1", keyHash: "h1" },
      { id: "h2_user-1", userId: "user-1", keyHash: "h2" },
      { id: "h1_user-2", userId: "user-2", keyHash: "h1" },
    ];
  });

  it("covers every per-user collection", () => {
    expect([...USER_DATA_COLLECTIONS].sort()).toEqual([
      "contacts",
      "coverLetters",
      "interviews",
      "jobApplicationNotes",
      "jobApplications",
      "resumeJobMatches",
      "userResumes",
    ]);
  });

  it("deletes the user's documents, profile, files and sign-in, and nobody else's", async () => {
    await expect(call(signedIn({ confirm: "DELETE" }))).resolves.toEqual({ deleted: true });

    for (const name of USER_DATA_COLLECTIONS) {
      expect(store[name].map((doc) => doc.id)).toEqual([`${name}-theirs`]);
    }
    // The jobs collection is a shared cache of job pages, not personal data
    expect(store.jobs).toHaveLength(1);
    expect(recursiveDeletes).toEqual(["users/user-1"]);
    expect(mockDeleteFiles).toHaveBeenCalledWith({ prefix: "resumes/user-1/" });
    expect(mockDeleteUser).toHaveBeenCalledWith("user-1");
  });

  it("deletes their posting reports and redoes the public counts they fed", async () => {
    await call(signedIn({ confirm: "DELETE" }));
    expect(store.jobReports.map((doc) => doc.id)).toEqual(["h1_user-2"]);
    expect(mockRefreshPublicReports.mock.calls).toEqual([["h1"], ["h2"]]);
  });

  it("removes the sign-in last, so a failed run can be retried", async () => {
    await call(signedIn({ confirm: "DELETE" }));
    expect(events.at(-1)).toBe("auth");
  });

  it("pages through large collections", async () => {
    store.jobApplications = Array.from({ length: 950 }, (_, index) => ({ id: `job-${index}`, userId: "user-1" }));
    await call(signedIn({ confirm: "DELETE" }));
    expect(store.jobApplications).toHaveLength(0);
  });

  it("asks for the typed confirmation", async () => {
    await expect(call(signedIn({ confirm: "delete" }))).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(call(signedIn({}))).rejects.toMatchObject({ code: "invalid-argument" });
    expect(deletedDocs).toHaveLength(0);
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("requires a real account", async () => {
    await expect(call({ auth: null, data: { confirm: "DELETE" } })).rejects.toMatchObject({ code: "unauthenticated" });
    await expect(call(signedIn({ confirm: "DELETE" }, "anonymous"))).rejects.toMatchObject({ code: "unauthenticated" });
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it.each(["active", "trialing", "past_due", "unpaid"])("refuses while a Pro subscription is %s", async (status) => {
    billingStatus = status;
    await expect(call(signedIn({ confirm: "DELETE" }))).rejects.toMatchObject({ code: "failed-precondition" });
    expect(deletedDocs).toHaveLength(0);
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("goes ahead once the subscription is canceled", async () => {
    billingStatus = "canceled";
    await expect(call(signedIn({ confirm: "DELETE" }))).resolves.toEqual({ deleted: true });
  });
});
