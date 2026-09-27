import { describe, expect, it } from "vitest";
import { plural } from "../plural";

describe("plural", () => {
  it("uses the singular only for exactly one", () => {
    expect(plural(1, "day")).toBe("1 day");
    expect(plural(0, "day")).toBe("0 days");
    expect(plural(2, "day")).toBe("2 days");
  });

  it("takes an irregular plural", () => {
    expect(plural(3, "thing", "things")).toBe("3 things");
    expect(plural(1, "match", "matches")).toBe("1 match");
  });
});
