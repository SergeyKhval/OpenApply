import { describe, expect, it } from "vitest";
import { sanitizeJobPosting } from "../../../../shared/jobPosting";

const now = Date.parse("2026-09-25T12:00:00Z");

describe("sanitizeJobPosting", () => {
  it("keeps valid fields", () => {
    const posting = {
      postedAt: "2025-05-16",
      postedAtSource: "json-ld",
      postedOrEarlier: true,
      reposted: true,
      validThrough: "2026-12-31",
    };
    expect(sanitizeJobPosting(posting, now)).toEqual(posting);
  });

  it("drops what isn't a real date or a known value", () => {
    expect(
      sanitizeJobPosting(
        {
          postedAt: "2026-02-30",
          postedAtSource: "gemini",
          postedOrEarlier: "yes",
          reposted: 1,
          validThrough: "soon",
          extra: "x",
        },
        now,
      ),
    ).toBeUndefined();
  });

  it("drops a posting date in the future or before 2000", () => {
    expect(sanitizeJobPosting({ postedAt: "2026-10-01", postedAtSource: "page" }, now)).toBeUndefined();
    expect(sanitizeJobPosting({ postedAt: "1999-12-31", postedAtSource: "page" }, now)).toBeUndefined();
  });

  it("needs a source with a posted date, and drops the date without one", () => {
    expect(sanitizeJobPosting({ postedAt: "2026-09-01" }, now)).toBeUndefined();
    expect(sanitizeJobPosting({ reposted: true, postedOrEarlier: true }, now)).toEqual({ reposted: true });
  });

  it("returns undefined for non-objects and empty postings", () => {
    expect(sanitizeJobPosting(null, now)).toBeUndefined();
    expect(sanitizeJobPosting("2026-09-01", now)).toBeUndefined();
    expect(sanitizeJobPosting({}, now)).toBeUndefined();
  });
});
