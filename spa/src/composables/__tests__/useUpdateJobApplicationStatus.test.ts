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

vi.mock("@internationalized/date", () => ({
  getLocalTimeZone: () => "America/New_York",
  today: () => ({
    toDate: () => new Date("2025-01-15"),
  }),
}));

import { useUpdateJobApplicationStatus } from "../useUpdateJobApplicationStatus";

describe("useUpdateJobApplicationStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const { updateJobApplicationStatus } = useUpdateJobApplicationStatus();

  it("sets hiredAt when status is hired", async () => {
    await updateJobApplicationStatus("app-1", "hired");
    expect(mockDoc).toHaveBeenCalledWith("mock-db", "jobApplications", "app-1");
    const updates = mockUpdateDoc.mock.calls[0][1];
    expect(updates.status).toBe("hired");
    expect(updates.hiredAt).toEqual(new Date("2025-01-15"));
    expect(updates.updatedAt).toBe("mock-timestamp");
  });

  it("sets offeredAt and nulls hiredAt when status is offered", async () => {
    await updateJobApplicationStatus("app-1", "offered");
    const updates = mockUpdateDoc.mock.calls[0][1];
    expect(updates.status).toBe("offered");
    expect(updates.offeredAt).toEqual(new Date("2025-01-15"));
    expect(updates.hiredAt).toBeNull();
  });

  it("sets interviewedAt, nulls offeredAt and hiredAt when status is interviewing", async () => {
    await updateJobApplicationStatus("app-1", "interviewing");
    const updates = mockUpdateDoc.mock.calls[0][1];
    expect(updates.status).toBe("interviewing");
    expect(updates.interviewedAt).toEqual(new Date("2025-01-15"));
    expect(updates.offeredAt).toBeNull();
    expect(updates.hiredAt).toBeNull();
  });

  it("nulls interviewedAt, offeredAt, hiredAt when status is applied", async () => {
    await updateJobApplicationStatus("app-1", "applied");
    const updates = mockUpdateDoc.mock.calls[0][1];
    expect(updates.status).toBe("applied");
    expect(updates.interviewedAt).toBeNull();
    expect(updates.offeredAt).toBeNull();
    expect(updates.hiredAt).toBeNull();
  });

  it("sets archivedAt when status is archived", async () => {
    await updateJobApplicationStatus("app-1", "archived");
    const updates = mockUpdateDoc.mock.calls[0][1];
    expect(updates.status).toBe("archived");
    expect(updates.archivedAt).toBe("mock-timestamp");
  });

  it("nulls all date fields when status is draft", async () => {
    await updateJobApplicationStatus("app-1", "draft");
    const updates = mockUpdateDoc.mock.calls[0][1];
    expect(updates.status).toBe("draft");
    expect(updates.appliedAt).toBeNull();
    expect(updates.interviewedAt).toBeNull();
    expect(updates.offeredAt).toBeNull();
    expect(updates.hiredAt).toBeNull();
    expect(updates.archivedAt).toBeNull();
  });

  it("calls updateDoc with correct doc reference", async () => {
    await updateJobApplicationStatus("app-xyz", "hired");
    expect(mockDoc).toHaveBeenCalledWith("mock-db", "jobApplications", "app-xyz");
    expect(mockUpdateDoc).toHaveBeenCalledWith("mock-doc-ref", expect.any(Object));
  });

  describe("follow-ups", () => {
    const { markApplied, snoozeFollowUp, clearFollowUp, scheduleFollowUp } = useUpdateJobApplicationStatus();

    it("I applied sets Applied, the applied date and a follow-up a week out", async () => {
      await markApplied("app-1");
      const updates = mockUpdateDoc.mock.calls[0][1];
      expect(updates.status).toBe("applied");
      expect(updates.appliedAt).toEqual(new Date("2025-01-15"));
      expect(updates.followUpAt).toEqual(new Date("2025-01-22"));
      expect(updates.interviewedAt).toBeNull();
    });

    it("snooze moves the follow-up 3 days from today", async () => {
      await snoozeFollowUp("app-1");
      const updates = mockUpdateDoc.mock.calls[0][1];
      expect(updates).toEqual({ followUpAt: new Date("2025-01-18"), updatedAt: "mock-timestamp" });
    });

    it("schedules a follow-up a week out by default", async () => {
      await scheduleFollowUp("app-1");
      expect(mockUpdateDoc.mock.calls[0][1]).toEqual({ followUpAt: new Date("2025-01-22"), updatedAt: "mock-timestamp" });
    });

    it("done clears the follow-up", async () => {
      await clearFollowUp("app-1");
      const updates = mockUpdateDoc.mock.calls[0][1];
      expect(updates).toEqual({ followUpAt: null, updatedAt: "mock-timestamp" });
    });

    it("withdrew is a closed status with no extra dates", async () => {
      await updateJobApplicationStatus("app-1", "withdrew");
      const updates = mockUpdateDoc.mock.calls[0][1];
      expect(updates).toEqual({ status: "withdrew", updatedAt: "mock-timestamp" });
    });
  });

  describe("moveToStage", () => {
    const { moveToStage } = useUpdateJobApplicationStatus();

    it("draft -> applied goes through markApplied (sets the follow-up)", async () => {
      await moveToStage({ id: "app-1", status: "draft" }, "applied");
      const updates = mockUpdateDoc.mock.calls[0][1];
      expect(updates.status).toBe("applied");
      expect(updates.followUpAt).toEqual(new Date("2025-01-22"));
    });

    it("non-draft job moving to applied is a plain status update, no follow-up", async () => {
      await moveToStage({ id: "app-1", status: "interviewing" }, "applied");
      const updates = mockUpdateDoc.mock.calls[0][1];
      expect(updates.status).toBe("applied");
      expect(updates.followUpAt).toBeUndefined();
    });

    it("maps each open stage to its underlying status", async () => {
      await moveToStage({ id: "app-1", status: "applied" }, "interviewing");
      expect(mockUpdateDoc.mock.calls[0][1].status).toBe("interviewing");

      mockUpdateDoc.mockClear();
      await moveToStage({ id: "app-1", status: "interviewing" }, "offer");
      expect(mockUpdateDoc.mock.calls[0][1].status).toBe("offered");

      mockUpdateDoc.mockClear();
      await moveToStage({ id: "app-1", status: "offered" }, "saved");
      expect(mockUpdateDoc.mock.calls[0][1].status).toBe("draft");
    });
  });
});
