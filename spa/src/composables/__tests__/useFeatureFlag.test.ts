import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const listeners: Array<() => void> = [];
const enabledFlags = new Set<string>();

vi.mock("posthog-js", () => ({
  default: {
    __loaded: true,
    onFeatureFlags: (callback: () => void) => listeners.push(callback),
    isFeatureEnabled: (flag: string) => enabledFlags.has(flag),
  },
}));

import { waitForFeatureFlag } from "../useFeatureFlag";

describe("waitForFeatureFlag", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("resolves true when flags load with the flag on", async () => {
    const result = waitForFeatureFlag("flag-on", 2000);
    enabledFlags.add("flag-on");
    listeners.forEach((listener) => listener());

    await expect(result).resolves.toBe(true);
  });

  it("resolves false after the timeout when the flag stays off", async () => {
    const result = waitForFeatureFlag("flag-off", 2000);
    listeners.forEach((listener) => listener());
    vi.advanceTimersByTime(2000);

    await expect(result).resolves.toBe(false);
  });
});
