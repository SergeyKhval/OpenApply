import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);
const mockDoc = vi.fn().mockReturnValue("mock-doc-ref");
const mockServerTimestamp = vi.fn().mockReturnValue("mock-timestamp");

vi.mock("firebase/firestore", () => ({
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  serverTimestamp: () => mockServerTimestamp(),
}));

vi.mock("@/firebase/config.ts", () => ({
  db: "mock-db",
}));

import { restoreJobApplication } from "../restoreJobApplication";
import type { JobApplication } from "@/types";

const makeApp = (overrides: Partial<JobApplication> = {}): JobApplication =>
  ({
    id: "app-1",
    companyName: "Acme",
    position: "Dev",
    jobDescription: "",
    technologies: [],
    status: "archived",
    createdAt: { seconds: 0, nanoseconds: 0 },
    userId: "u1",
    ...overrides,
  }) as unknown as JobApplication;

describe("restoreJobApplication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restores to hired when hiredAt exists", async () => {
    await restoreJobApplication(makeApp({ hiredAt: new Date("2025-01-01") as unknown as import("@internationalized/date").CalendarDate }));
    const updates = mockUpdateDoc.mock.calls[0][1];
    expect(updates.status).toBe("hired");
    expect(updates.updatedAt).toBe("mock-timestamp");
  });

  it("restores to offered when offeredAt exists (no hiredAt)", async () => {
    await restoreJobApplication(makeApp({ offeredAt: new Date("2025-01-01") as unknown as import("@internationalized/date").CalendarDate }));
    const updates = mockUpdateDoc.mock.calls[0][1];
    expect(updates.status).toBe("offered");
  });

  it("restores to interviewing when interviewedAt exists", async () => {
    await restoreJobApplication(makeApp({ interviewedAt: new Date("2025-01-01") as unknown as import("@internationalized/date").CalendarDate }));
    const updates = mockUpdateDoc.mock.calls[0][1];
    expect(updates.status).toBe("interviewing");
  });

  it("falls back to applied when no date fields", async () => {
    await restoreJobApplication(makeApp());
    const updates = mockUpdateDoc.mock.calls[0][1];
    expect(updates.status).toBe("applied");
  });

  it("does nothing for null application", () => {
    const result = restoreJobApplication(null as unknown as JobApplication);
    expect(result).toBeUndefined();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it("calls updateDoc with correct doc reference", async () => {
    await restoreJobApplication(makeApp({ id: "app-xyz" }));
    expect(mockDoc).toHaveBeenCalledWith("mock-db", "jobApplications", "app-xyz");
    expect(mockUpdateDoc).toHaveBeenCalledWith("mock-doc-ref", expect.any(Object));
  });
});
