import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPush = vi.fn();
const mockQuery = { value: {} as Record<string, string> };

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useRoute: () => ({ query: mockQuery.value }),
}));

import { usePostAuthRedirect } from "../usePostAuthRedirect";

describe("usePostAuthRedirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.value = {};
  });

  it("redirects to job review page when job query param is present", () => {
    mockQuery.value = { job: "abc123" };
    const { redirect } = usePostAuthRedirect();
    redirect();
    expect(mockPush).toHaveBeenCalledWith("/dashboard/applications/new?job=abc123");
  });

  it("includes from=lp when LP source param is present", () => {
    mockQuery.value = { job: "abc123", from: "lp" };
    const { redirect } = usePostAuthRedirect();
    redirect();
    expect(mockPush).toHaveBeenCalledWith("/dashboard/applications/new?job=abc123&from=lp");
  });

  it("redirects to dashboard when no job query param", () => {
    mockQuery.value = {};
    const { redirect } = usePostAuthRedirect();
    redirect();
    expect(mockPush).toHaveBeenCalledWith("/dashboard/applications");
  });

  it("returns hasPendingJob true when job param exists", () => {
    mockQuery.value = { job: "abc123" };
    const { hasPendingJob } = usePostAuthRedirect();
    expect(hasPendingJob.value).toBe(true);
  });

  it("returns hasPendingJob false when no job param", () => {
    mockQuery.value = {};
    const { hasPendingJob } = usePostAuthRedirect();
    expect(hasPendingJob.value).toBe(false);
  });
});
