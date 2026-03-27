import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPush = vi.fn();
const mockQuery = { value: {} as Record<string, string> };

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useRoute: () => ({ query: mockQuery.value }),
}));

vi.mock("@/composables/useJobIngestion", () => ({
  isValidJobId: (val: unknown) => typeof val === "string" && /^[a-zA-Z0-9]{10,30}$/.test(val),
}));

import { usePostAuthRedirect } from "../usePostAuthRedirect";

describe("usePostAuthRedirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.value = {};
  });

  it("redirects to job review page when job query param is present", () => {
    mockQuery.value = { job: "HA5pNcg3AjtPuDRWtqds" };
    const { redirect } = usePostAuthRedirect();
    redirect();
    expect(mockPush).toHaveBeenCalledWith("/dashboard/applications/new?job=HA5pNcg3AjtPuDRWtqds");
  });

  it("includes from=lp when LP source param is present", () => {
    mockQuery.value = { job: "HA5pNcg3AjtPuDRWtqds", from: "lp" };
    const { redirect } = usePostAuthRedirect();
    redirect();
    expect(mockPush).toHaveBeenCalledWith("/dashboard/applications/new?job=HA5pNcg3AjtPuDRWtqds&from=lp");
  });

  it("redirects to saved redirect path when present", () => {
    mockQuery.value = { redirect: "/dashboard/applications/abc123" };
    const { redirect } = usePostAuthRedirect();
    redirect();
    expect(mockPush).toHaveBeenCalledWith("/dashboard/applications/abc123");
  });

  it("ignores redirect param that does not start with /", () => {
    mockQuery.value = { redirect: "https://evil.com" };
    const { redirect } = usePostAuthRedirect();
    redirect();
    expect(mockPush).toHaveBeenCalledWith("/dashboard/applications");
  });

  it("redirects to dashboard when no job or redirect query param", () => {
    mockQuery.value = {};
    const { redirect } = usePostAuthRedirect();
    redirect();
    expect(mockPush).toHaveBeenCalledWith("/dashboard/applications");
  });

  it("returns hasPendingJob true when job param exists", () => {
    mockQuery.value = { job: "HA5pNcg3AjtPuDRWtqds" };
    const { hasPendingJob } = usePostAuthRedirect();
    expect(hasPendingJob.value).toBe(true);
  });

  it("returns hasPendingJob false when no job param", () => {
    mockQuery.value = {};
    const { hasPendingJob } = usePostAuthRedirect();
    expect(hasPendingJob.value).toBe(false);
  });
});
