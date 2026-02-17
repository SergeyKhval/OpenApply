import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";

const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockDoc = vi.fn().mockReturnValue("mock-doc-ref");
const mockCollection = vi.fn().mockReturnValue("mock-collection-ref");
const mockServerTimestamp = vi.fn().mockReturnValue("mock-timestamp");

vi.mock("firebase/firestore", () => ({
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  serverTimestamp: () => mockServerTimestamp(),
}));

vi.mock("@/firebase/config", () => ({
  db: "mock-db",
}));

const mockUser = ref<{ uid: string } | null>({ uid: "user-123" });

vi.mock("vuefire", () => ({
  useCurrentUser: () => mockUser,
}));

vi.mock("@internationalized/date", () => ({
  getLocalTimeZone: () => "America/New_York",
}));

import { useJobApplications } from "../useJobApplications";

describe("useJobApplications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.value = { uid: "user-123" };
  });

  describe("addJobApplication", () => {
    it("returns error when not authenticated", async () => {
      mockUser.value = null;
      const { addJobApplication } = useJobApplications();
      const result = await addJobApplication({
        companyName: "Acme",
        position: "Dev",
        jobDescription: "",
        technologies: [],
      } as import("@/types").CreateJobApplicationInput);
      expect(result.success).toBe(false);
      expect(result.error).toBe("User not authenticated");
    });

    it("calls addDoc with correct payload", async () => {
      mockAddDoc.mockResolvedValueOnce({ id: "new-doc-id" });
      const { addJobApplication } = useJobApplications();
      const payload = {
        companyName: "Acme",
        position: "Developer",
        jobDescription: "Build stuff",
        technologies: ["Vue"],
      } as import("@/types").CreateJobApplicationInput;

      const result = await addJobApplication(payload);
      expect(result.success).toBe(true);
      expect(result.id).toBe("new-doc-id");
      expect(mockAddDoc).toHaveBeenCalledWith("mock-collection-ref", {
        ...payload,
        status: "draft",
        userId: "user-123",
        createdAt: "mock-timestamp",
      });
    });
  });

  describe("updateJobApplication", () => {
    it("returns error when not authenticated", async () => {
      mockUser.value = null;
      const { updateJobApplication } = useJobApplications();
      const result = await updateJobApplication("app-1", {
        companyName: "New",
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("User not authenticated");
    });

    it("sanitizes CalendarDate fields to Date objects", async () => {
      mockUpdateDoc.mockResolvedValueOnce(undefined);
      const { updateJobApplication } = useJobApplications();
      const mockDate = new Date("2025-01-15");
      const calendarDate = {
        toDate: () => mockDate,
      };

      const result = await updateJobApplication("app-1", {
        appliedAt: calendarDate as unknown as import("@internationalized/date").CalendarDate,
      });

      expect(result.success).toBe(true);
      const passedData = mockUpdateDoc.mock.calls[0][1];
      expect(passedData.appliedAt).toBe(mockDate);
      expect(passedData.updatedAt).toBe("mock-timestamp");
    });
  });

  describe("deleteJobApplication", () => {
    it("returns error when not authenticated", async () => {
      mockUser.value = null;
      const { deleteJobApplication } = useJobApplications();
      const result = await deleteJobApplication("app-1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("User not authenticated");
    });

    it("calls deleteDoc with correct reference", async () => {
      mockDeleteDoc.mockResolvedValueOnce(undefined);
      const { deleteJobApplication } = useJobApplications();
      const result = await deleteJobApplication("app-1");
      expect(result.success).toBe(true);
      expect(mockDoc).toHaveBeenCalledWith("mock-db", "jobApplications", "app-1");
      expect(mockDeleteDoc).toHaveBeenCalledWith("mock-doc-ref");
    });
  });
});
