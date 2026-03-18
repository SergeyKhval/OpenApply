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

// Firestore mock — configurable per test
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

// Unwrap the task handler so we can call it directly
vi.mock("firebase-functions/v2/tasks", () => ({
  onTaskDispatched: (_config: unknown, fn: (req: unknown) => Promise<void>) => fn,
}));

import { subDays } from "date-fns";
import { processUserDigest } from "../processUserDigest";

// Helper: build a Firestore-like doc snapshot
function makeAppDoc(
  id: string,
  userId: string,
  status: string,
  daysOld: number,
  now: Date,
) {
  const updatedAt = subDays(now, daysOld);
  const createdAt = subDays(now, daysOld);
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

describe("processUserDigest", () => {
  const now = new Date("2024-06-03T09:00:00Z");

  beforeEach(() => {
    vi.clearAllMocks();
    mockAppsSnapshot = { empty: true, docs: [] };
    mockInterviewsSnapshot = { docs: [] };
    mockGet.mockImplementation(() => Promise.resolve(mockAppsSnapshot));
  });

  it("sends email when user has actionable applications", async () => {
    const appDoc = makeAppDoc("app-1", "user-1", "applied", 17, now);
    mockAppsSnapshot = { empty: false, docs: [appDoc] };

    let callCount = 0;
    mockGet.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(mockAppsSnapshot);
      return Promise.resolve(mockInterviewsSnapshot);
    });

    await (processUserDigest as unknown as (req: unknown) => Promise<void>)({
      data: { userId: "user-1" },
    });

    expect(mockSend).toHaveBeenCalledOnce();
    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.to).toBe("user@example.com");
    expect(callArgs.subject).toBe("Your Weekly Job Search Update");
    expect(callArgs.from).toBe("Sergey <sergey@openapply.app>");
    expect(callArgs.headers).toBeUndefined();
  });

  it("skips when user has no active applications", async () => {
    mockAppsSnapshot = { empty: true, docs: [] };
    mockGet.mockResolvedValue(mockAppsSnapshot);

    await (processUserDigest as unknown as (req: unknown) => Promise<void>)({
      data: { userId: "user-1" },
    });

    expect(mockSend).not.toHaveBeenCalled();
  });

  it("skips when digest is empty (no actionable items)", async () => {
    // "hired" status skips all action categories, and being old enough means no wins either.
    // Note: processUserDigest uses real Date.now(), so daysOld is relative to actual current time.
    const realNow = new Date();
    const appDoc = makeAppDoc("app-1", "user-1", "hired", 30, realNow);
    mockAppsSnapshot = { empty: false, docs: [appDoc] };

    let callCount = 0;
    mockGet.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(mockAppsSnapshot);
      return Promise.resolve(mockInterviewsSnapshot);
    });

    await (processUserDigest as unknown as (req: unknown) => Promise<void>)({
      data: { userId: "user-1" },
    });

    expect(mockSend).not.toHaveBeenCalled();
  });

  it("skips when user has no email", async () => {
    const appDoc = makeAppDoc("app-1", "user-1", "applied", 17, now);
    mockAppsSnapshot = { empty: false, docs: [appDoc] };

    let callCount = 0;
    mockGet.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(mockAppsSnapshot);
      return Promise.resolve(mockInterviewsSnapshot);
    });

    mockGetUser.mockResolvedValueOnce({ email: undefined });

    await (processUserDigest as unknown as (req: unknown) => Promise<void>)({
      data: { userId: "user-1" },
    });

    expect(mockSend).not.toHaveBeenCalled();
  });
});
