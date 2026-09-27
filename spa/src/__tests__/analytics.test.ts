import { describe, expect, it, vi, beforeEach } from "vitest";

const mockIdentify = vi.fn();
vi.mock("posthog-js", () => ({
  default: {
    __loaded: true,
    identify: (...args: unknown[]) => mockIdentify(...args),
    reset: vi.fn(),
    capture: vi.fn(),
  },
}));

import posthog from "posthog-js";
import { identifyUser } from "../analytics";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("identifyUser", () => {
  it("tags a school-domain email as email_domain_type: school, without sending the email anywhere new", () => {
    identifyUser("u1", { email: "student@eic.edu", authMethod: "email_code" });

    expect(mockIdentify).toHaveBeenCalledWith("u1", {
      email: "student@eic.edu",
      authMethod: "email_code",
      email_domain_type: "school",
    });
  });

  it("tags a regular email as email_domain_type: other", () => {
    identifyUser("u2", { email: "sam@gmail.com", authMethod: "google" });

    expect(mockIdentify).toHaveBeenCalledWith("u2", {
      email: "sam@gmail.com",
      authMethod: "google",
      email_domain_type: "other",
    });
  });

  it("does nothing when posthog has not loaded", () => {
    (posthog as unknown as { __loaded: boolean }).__loaded = false;

    identifyUser("u3", { email: "sam@gmail.com", authMethod: "google" });

    expect(mockIdentify).not.toHaveBeenCalled();
    (posthog as unknown as { __loaded: boolean }).__loaded = true;
  });
});
