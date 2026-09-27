import { describe, it, expect, vi } from "vitest";
import {
  APP_ENTRY_MARKER_KEY,
  recordAppEntry,
  redirectBrandNewEntrant,
  type AppEntry,
  type RedirectDeps,
} from "../appEntryRedirect";
import { ACQUISITION_STORAGE_KEY } from "../../../../shared/acquisition";

function createStorage(initial: Record<string, string> = {}) {
  const entries = new Map(Object.entries(initial));
  return {
    entries,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => void entries.set(key, value),
  };
}

const brandNew: AppEntry = { returning: false, path: "/app/", search: "", referrer: "" };

function makeDeps(overrides: Partial<RedirectDeps> = {}) {
  const redirect = vi.fn();
  const deps: RedirectDeps = {
    base: "/app",
    hasSession: async () => false,
    isFlagEnabled: async () => true,
    currentPath: () => "/app/",
    redirect,
    ...overrides,
  };
  return { deps, redirect };
}

describe("recordAppEntry", () => {
  const location = { pathname: "/app/", search: "" };

  it("treats a visitor with no marker and no first touch as new, then marks them", () => {
    const storage = createStorage();

    expect(recordAppEntry(storage, location, "").returning).toBe(false);
    expect(storage.entries.get(APP_ENTRY_MARKER_KEY)).toBe("1");
    expect(recordAppEntry(storage, location, "").returning).toBe(true);
  });

  it("treats a visitor who already saw the landing (first touch recorded) as returning", () => {
    const storage = createStorage({ [ACQUISITION_STORAGE_KEY]: "{}" });

    expect(recordAppEntry(storage, location, "").returning).toBe(true);
  });

  it("treats blocked or missing storage as returning, since the marker can't be kept", () => {
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {},
    };

    expect(recordAppEntry(throwing, location, "").returning).toBe(true);
    expect(recordAppEntry(undefined, location, "").returning).toBe(true);
  });

  it("keeps the path, query and referrer it was given", () => {
    const entry = recordAppEntry(createStorage(), { pathname: "/app/jobs", search: "?a=1" }, "https://x.com/");

    expect(entry).toMatchObject({ path: "/app/jobs", search: "?a=1", referrer: "https://x.com/" });
  });
});

describe("redirectBrandNewEntrant", () => {
  it("sends a brand-new, direct, signed-out visitor to the landing when the flag is on", async () => {
    const { deps, redirect } = makeDeps();

    expect(await redirectBrandNewEntrant(brandNew, deps)).toBe(true);
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("also matches /app without the trailing slash", async () => {
    const { deps, redirect } = makeDeps({ currentPath: () => "/app" });

    expect(await redirectBrandNewEntrant({ ...brandNew, path: "/app" }, deps)).toBe(true);
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it.each([
    ["has a referrer", { referrer: "https://www.google.com/" }],
    ["has a UTM param", { search: "?utm_source=reddit" }],
    ["has any other query param", { search: "?redirect=/jobs" }],
    ["is returning (marker set)", { returning: true }],
    ["opened a deep link", { path: "/app/jobs" }],
  ])("leaves a visitor alone who %s", async (_label, change) => {
    const { deps, redirect } = makeDeps();

    expect(await redirectBrandNewEntrant({ ...brandNew, ...change }, deps)).toBe(false);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("leaves a signed-in visitor alone and doesn't ask for the flag", async () => {
    const isFlagEnabled = vi.fn(async () => true);
    const { deps, redirect } = makeDeps({ hasSession: async () => true, isFlagEnabled });

    expect(await redirectBrandNewEntrant(brandNew, deps)).toBe(false);
    expect(isFlagEnabled).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("does nothing when the flag is off", async () => {
    const { deps, redirect } = makeDeps({ isFlagEnabled: async () => false });

    expect(await redirectBrandNewEntrant(brandNew, deps)).toBe(false);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("does nothing if they signed in while the flag loaded", async () => {
    const hasSession = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { deps, redirect } = makeDeps({ hasSession });

    expect(await redirectBrandNewEntrant(brandNew, deps)).toBe(false);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("does nothing if they left the sign-in screen while the flag loaded", async () => {
    const { deps, redirect } = makeDeps({ currentPath: () => "/app/jobs" });

    expect(await redirectBrandNewEntrant(brandNew, deps)).toBe(false);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("happens at most once: the second visit is returning", async () => {
    const storage = createStorage();
    const location = { pathname: "/app/", search: "" };
    const { deps, redirect } = makeDeps();

    await redirectBrandNewEntrant(recordAppEntry(storage, location, ""), deps);
    await redirectBrandNewEntrant(recordAppEntry(storage, location, ""), deps);

    expect(redirect).toHaveBeenCalledTimes(1);
  });
});
