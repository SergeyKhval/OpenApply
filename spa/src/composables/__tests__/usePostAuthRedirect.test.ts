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

const mockAddJobApplication = vi.fn();

vi.mock("@/composables/useJobApplications", () => ({
  useJobApplications: () => ({ addJobApplication: mockAddJobApplication }),
}));

import { usePostAuthRedirect } from "../usePostAuthRedirect";
import {
  PENDING_TOOL_APPLICATION_KEY,
  resetPendingToolApplicationState,
} from "../pendingToolApplication";

const pendingToolApplication = {
  version: 1,
  savedAt: new Date().toISOString(),
  companyName: "Acme",
  position: "Frontend Engineer",
  jobDescription: "Build accessible Vue apps.",
  technologies: ["Vue"],
  match: {
    matchScore: 62,
    verdict: "Close.",
    parseCheck: { status: "clean", note: "" },
    requirements: [],
    missingKeywords: [],
    fixes: [],
  },
};

describe("usePostAuthRedirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.value = {};
    localStorage.clear();
    resetPendingToolApplicationState();
  });

  it("creates the application saved by the match tool and opens it", async () => {
    localStorage.setItem(PENDING_TOOL_APPLICATION_KEY, JSON.stringify(pendingToolApplication));
    mockAddJobApplication.mockResolvedValue({ success: true, id: "app123" });
    const { redirect } = usePostAuthRedirect();

    await Promise.all([redirect(), redirect()]);

    expect(mockAddJobApplication).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/dashboard/applications/app123?from=tool");
    expect(mockPush).not.toHaveBeenCalledWith("/dashboard/applications");
    expect(localStorage.getItem(PENDING_TOOL_APPLICATION_KEY)).toBeNull();
  });

  it("opens a job saved by the browser extension with the saved prompt", async () => {
    const { match: _match, ...job } = pendingToolApplication;
    localStorage.setItem(PENDING_TOOL_APPLICATION_KEY, JSON.stringify({ ...job, source: "extension" }));
    mockAddJobApplication.mockResolvedValue({ success: true, id: "app456" });
    const { redirect } = usePostAuthRedirect();

    await redirect();

    expect(mockAddJobApplication).toHaveBeenCalledWith(expect.anything(), { source: "extension" });
    expect(mockPush).toHaveBeenCalledWith("/dashboard/applications/app456?created=1");
  });

  it("falls back to the default redirect and keeps the job when creation fails", async () => {
    localStorage.setItem(PENDING_TOOL_APPLICATION_KEY, JSON.stringify(pendingToolApplication));
    mockAddJobApplication.mockResolvedValue({ success: false, error: "nope" });
    const { redirect } = usePostAuthRedirect();

    await redirect();

    expect(mockPush).toHaveBeenCalledWith("/dashboard/applications");
    expect(localStorage.getItem(PENDING_TOOL_APPLICATION_KEY)).not.toBeNull();
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
