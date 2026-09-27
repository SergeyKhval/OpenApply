import { describe, it, expect, vi, beforeEach } from "vitest";

const mockHttpsCallable = vi.fn();
vi.mock("firebase/functions", () => ({
  httpsCallable: () => mockHttpsCallable,
}));
vi.mock("@/firebase/config", () => ({ functions: "mock-functions" }));

const mockTrackEvent = vi.fn();
vi.mock("@/analytics", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

const mockToast = vi.fn();
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

import { useProSubscription } from "../useProSubscription";

describe("useProSubscription", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, href: "https://openapply.app/app/settings/plan", assign: vi.fn() },
    });
  });

  it("tracks checkout_started and redirects when checkout succeeds", async () => {
    mockHttpsCallable.mockResolvedValueOnce({ data: { url: "https://checkout.stripe.com/session-1" } });
    const { startProCheckout } = useProSubscription();

    await startProCheckout("ai_review");

    expect(mockTrackEvent).toHaveBeenCalledWith("checkout_started", { plan: "pro", source: "ai_review" });
    expect(window.location.assign).toHaveBeenCalledWith("https://checkout.stripe.com/session-1");
  });

  it("does not track checkout_started when the callable returns no url", async () => {
    mockHttpsCallable.mockResolvedValueOnce({ data: { url: null } });
    const { startProCheckout } = useProSubscription();

    await startProCheckout("ai_review");

    expect(mockTrackEvent).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Something went wrong" }),
    );
  });

  it("tracks billing_portal_opened and redirects when the portal session succeeds", async () => {
    mockHttpsCallable.mockResolvedValueOnce({ data: { url: "https://billing.stripe.com/portal-1" } });
    const { openBillingPortal } = useProSubscription();

    await openBillingPortal();

    expect(mockTrackEvent).toHaveBeenCalledWith("billing_portal_opened");
    expect(window.location.assign).toHaveBeenCalledWith("https://billing.stripe.com/portal-1");
  });

  it("does not track billing_portal_opened when the callable throws", async () => {
    mockHttpsCallable.mockRejectedValueOnce(new Error("boom"));
    const { openBillingPortal } = useProSubscription();

    await openBillingPortal();

    expect(mockTrackEvent).not.toHaveBeenCalled();
  });
});
