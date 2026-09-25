import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSet = vi.fn().mockResolvedValue(undefined);
const mockDoc = vi.fn(() => ({ set: mockSet }));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({ collection: () => ({ doc: mockDoc }) }),
  FieldValue: { serverTimestamp: () => "server-time" },
}));

vi.mock("firebase-functions/v2/https", () => ({
  onCall: (fn: (request: unknown) => unknown) => fn,
  HttpsError: class HttpsError extends Error {
    constructor(public code: string, message: string) {
      super(message);
    }
  },
}));

import { setEmailPreferences } from "../emailPreferences";

const call = setEmailPreferences as unknown as (request: unknown) => Promise<unknown>;
const signedIn = (data: unknown, provider = "google.com") => ({
  auth: { uid: "user-1", token: { firebase: { sign_in_provider: provider } } },
  data,
});

describe("setEmailPreferences", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves the Monday summary choice on the user's profile", async () => {
    await expect(call(signedIn({ weeklyDigest: false }))).resolves.toEqual({ weeklyDigest: false });
    expect(mockDoc).toHaveBeenCalledWith("user-1");
    expect(mockSet).toHaveBeenCalledWith(
      { emailPrefs: { weeklyDigest: false }, updatedAt: "server-time" },
      { merge: true },
    );
  });

  it("requires a real account", async () => {
    await expect(call({ auth: null, data: { weeklyDigest: false } })).rejects.toMatchObject({ code: "unauthenticated" });
    await expect(call(signedIn({ weeklyDigest: false }, "anonymous"))).rejects.toMatchObject({ code: "unauthenticated" });
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("rejects bad input", async () => {
    await expect(call(signedIn({ weeklyDigest: "no" }))).rejects.toMatchObject({ code: "invalid-argument" });
    expect(mockSet).not.toHaveBeenCalled();
  });
});
