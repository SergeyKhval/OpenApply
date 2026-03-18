import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks (must be hoisted before imports) ---

const mockSend = vi.fn().mockResolvedValue({ id: "email-id" });

vi.mock("resend", () => {
  const ResendMock = function (this: unknown) {
    (this as { emails: { send: typeof mockSend } }).emails = { send: mockSend };
  };
  return { Resend: ResendMock };
});

vi.mock("firebase-functions/params", () => ({
  defineString: () => ({ value: () => "test-key" }),
}));

const mockGetUser = vi.fn().mockResolvedValue({ email: "user@example.com" });

vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({ getUser: mockGetUser }),
}));

// Firestore mock — configurable per test via mockAppsSnapshot / mockInterviewsSnapshot
let mockAppsSnapshot = { empty: true, docs: [] as unknown[] };
let mockInterviewsSnapshot = { docs: [] as unknown[] };

const mockWhere = vi.fn();
const mockGet = vi.fn();

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: (name: string) => ({
      where: (...args: unknown[]) => {
        mockWhere(name, ...args);
        return {
          where: (...args2: unknown[]) => {
            mockWhere(name, ...args2);
            return { get: mockGet };
          },
          get: mockGet,
        };
      },
    }),
  }),
}));

// Unwrap the scheduler so we can call the handler directly
vi.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: (_config: unknown, fn: () => Promise<void>) => fn,
}));

import { sendWeeklyDigest } from "../sendWeeklyDigest";

// Helper: build a Firestore-like doc snapshot
function makeAppDoc(
  id: string,
  userId: string,
  status: string,
  daysOld: number,
  now: Date,
) {
  const updatedAt = new Date(now.getTime() - daysOld * 24 * 60 * 60 * 1000);
  const createdAt = new Date(now.getTime() - daysOld * 24 * 60 * 60 * 1000);
  return {
    id,
    data: () => ({
      userId,
      companyName: "Acme Corp",
      position: "Engineer",
      status,
      updatedAt: { toDate: () => updatedAt },
      createdAt: { toDate: () => createdAt },
    }),
  };
}

describe("sendWeeklyDigest", () => {
  const now = new Date("2024-06-03T09:00:00Z");

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no active apps
    mockAppsSnapshot = { empty: true, docs: [] };
    mockInterviewsSnapshot = { docs: [] };
    // Route get() calls: first call is for jobApplications, subsequent are for interviews
    mockGet.mockImplementation(() => {
      // We'll override this per test
      return Promise.resolve(mockAppsSnapshot);
    });
  });

  it("sends email when user has actionable applications (applied 17+ days ago)", async () => {
    const appDoc = makeAppDoc("app-1", "user-1", "applied", 17, now);
    mockAppsSnapshot = { empty: false, docs: [appDoc] };

    let callCount = 0;
    mockGet.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(mockAppsSnapshot);
      return Promise.resolve(mockInterviewsSnapshot);
    });

    await (sendWeeklyDigest as unknown as () => Promise<void>)();

    expect(mockSend).toHaveBeenCalledOnce();
    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.to).toBe("user@example.com");
    expect(callArgs.subject).toBe("Your Weekly Job Search Update");
    expect(callArgs.from).toBe("OpenApply <digest@openapply.app>");
    expect(callArgs.headers["List-Unsubscribe"]).toContain("settings");
  });

  it("skips sending when there are no active applications", async () => {
    mockAppsSnapshot = { empty: true, docs: [] };
    mockGet.mockResolvedValue(mockAppsSnapshot);

    await (sendWeeklyDigest as unknown as () => Promise<void>)();

    expect(mockSend).not.toHaveBeenCalled();
  });

  it("does not crash when a single user errors, continues processing other users", async () => {
    const app1 = makeAppDoc("app-1", "user-1", "applied", 17, now);
    const app2 = makeAppDoc("app-2", "user-2", "applied", 17, now);
    mockAppsSnapshot = { empty: false, docs: [app1, app2] };

    let callCount = 0;
    mockGet.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(mockAppsSnapshot);
      return Promise.resolve(mockInterviewsSnapshot);
    });

    // First user throws, second should still receive email
    mockGetUser
      .mockRejectedValueOnce(new Error("Auth error for user-1"))
      .mockResolvedValueOnce({ email: "user2@example.com" });

    await (sendWeeklyDigest as unknown as () => Promise<void>)();

    // Only the second user's email is sent
    expect(mockSend).toHaveBeenCalledOnce();
    expect(mockSend.mock.calls[0][0].to).toBe("user2@example.com");
  });
});
