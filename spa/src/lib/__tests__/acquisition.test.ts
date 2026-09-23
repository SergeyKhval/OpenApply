import { describe, it, expect } from "vitest";
import {
  ACQUISITION_STORAGE_KEY,
  buildAcquisition,
  captureFirstTouch,
  readAcquisition,
} from "../../../../shared/acquisition";

function createStorage(initial: Record<string, string> = {}) {
  const entries = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => void entries.set(key, value),
  };
}

const now = new Date("2026-09-23T10:00:00.000Z");

describe("buildAcquisition", () => {
  it("captures utm params, external referrer host, and landing path", () => {
    const url = new URL(
      "https://openapply.app/app/?utm_source=reddit&utm_medium=post&utm_campaign=sprint-2609&utm_content=v1&token=secret",
    );

    expect(buildAcquisition(url, "https://www.reddit.com/r/jobs/", now)).toEqual({
      utm_source: "reddit",
      utm_medium: "post",
      utm_campaign: "sprint-2609",
      utm_content: "v1",
      referrer_host: "www.reddit.com",
      landing_path: "/app/",
      captured_at: "2026-09-23T10:00:00.000Z",
    });
  });

  it("omits missing params and same-site or invalid referrers", () => {
    const url = new URL("https://openapply.app/blog/post");

    expect(buildAcquisition(url, "https://openapply.app/", now)).toEqual({
      landing_path: "/blog/post",
      captured_at: "2026-09-23T10:00:00.000Z",
    });
    expect(buildAcquisition(url, "not a url", now).referrer_host).toBeUndefined();
  });

  it("truncates long values", () => {
    const url = new URL(`https://openapply.app/?utm_source=${"a".repeat(500)}`);

    expect(buildAcquisition(url, "", now).utm_source).toHaveLength(200);
  });
});

describe("captureFirstTouch", () => {
  it("stores the first visit and keeps it on later visits", () => {
    const storage = createStorage();
    const first = captureFirstTouch(
      storage,
      new URL("https://openapply.app/?utm_source=hn"),
      "https://news.ycombinator.com/",
      now,
    );
    const second = captureFirstTouch(
      storage,
      new URL("https://openapply.app/app/?utm_source=x"),
      "",
      new Date("2026-09-24T10:00:00.000Z"),
    );

    expect(second).toEqual(first);
    expect(readAcquisition(storage)?.utm_source).toBe("hn");
  });

  it("replaces corrupted stored values", () => {
    const storage = createStorage({ [ACQUISITION_STORAGE_KEY]: "{broken" });

    const acquisition = captureFirstTouch(storage, new URL("https://openapply.app/"), "", now);

    expect(acquisition?.landing_path).toBe("/");
    expect(readAcquisition(storage)?.landing_path).toBe("/");
  });

  it("still returns the visit when storage writes fail", () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };

    expect(captureFirstTouch(storage, new URL("https://openapply.app/"), "", now)).not.toBeNull();
  });
});
