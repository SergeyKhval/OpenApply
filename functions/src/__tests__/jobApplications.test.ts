import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAdd = vi.fn().mockResolvedValue({ id: "doc-id" });
const mockCollection = vi.fn().mockReturnValue({ add: mockAdd });

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: (...args: unknown[]) => mockCollection(...args),
  }),
  FieldValue: {
    serverTimestamp: () => "mock-timestamp",
  },
}));

vi.mock("firebase-functions/v2/https", () => {
  class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  }
  return {
    HttpsError,
    onCall: (fn: Function) => fn,
  };
});

import { importJobApplications } from "../jobApplications";

describe("importJobApplications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const callImport = (data: unknown, auth?: { uid: string }) =>
    (importJobApplications as unknown as Function)({ data, auth });

  it("rejects unauthenticated requests", async () => {
    await expect(
      callImport({ applications: [] }),
    ).rejects.toThrow("User must be authenticated");
  });

  it("rejects non-array applications", async () => {
    await expect(
      callImport({ applications: "not-array" }, { uid: "user-1" }),
    ).rejects.toThrow("applications must be an array");
  });

  it("rejects missing applications field", async () => {
    await expect(
      callImport({}, { uid: "user-1" }),
    ).rejects.toThrow("applications must be an array");
  });

  it("skips applications missing companyName", async () => {
    const result = await callImport(
      {
        applications: [
          { position: "Dev" },
          { companyName: "Acme", position: "Dev" },
        ],
      },
      { uid: "user-1" },
    );

    expect(result.success).toBe(true);
    // Only the valid application triggers add
    expect(mockAdd).toHaveBeenCalledTimes(1);
  });

  it("skips applications missing position", async () => {
    const result = await callImport(
      {
        applications: [
          { companyName: "Acme" },
          { companyName: "Acme", position: "Dev" },
        ],
      },
      { uid: "user-1" },
    );

    expect(result.success).toBe(true);
    expect(mockAdd).toHaveBeenCalledTimes(1);
  });

  it("creates valid applications with correct fields", async () => {
    const result = await callImport(
      {
        applications: [{ companyName: "Acme", position: "Dev" }],
      },
      { uid: "user-1" },
    );

    expect(result.success).toBe(true);
    expect(result.total).toBe(1);
    expect(mockAdd).toHaveBeenCalledWith({
      companyName: "Acme",
      position: "Dev",
      userId: "user-1",
      status: "draft",
      createdAt: "mock-timestamp",
      updatedAt: "mock-timestamp",
    });
  });
});
