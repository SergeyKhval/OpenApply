import { describe, it, expect } from "vitest";
import { CREDIT_PACKS, CREDIT_PACKS_MAP } from "../creditPacks";

describe("CREDIT_PACKS", () => {
  it("has 3 packs", () => {
    expect(CREDIT_PACKS).toHaveLength(3);
  });

  it("each pack has required fields", () => {
    for (const pack of CREDIT_PACKS) {
      expect(pack).toHaveProperty("id");
      expect(pack).toHaveProperty("price");
      expect(pack).toHaveProperty("credits");
      expect(typeof pack.id).toBe("string");
      expect(typeof pack.price).toBe("number");
      expect(typeof pack.credits).toBe("number");
    }
  });

  it("all pack ids are unique", () => {
    const ids = CREDIT_PACKS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("credits increase with price", () => {
    for (let i = 1; i < CREDIT_PACKS.length; i++) {
      expect(CREDIT_PACKS[i].credits).toBeGreaterThan(
        CREDIT_PACKS[i - 1].credits,
      );
    }
  });
});

describe("CREDIT_PACKS_MAP", () => {
  it("maps each pack id to its credits", () => {
    for (const pack of CREDIT_PACKS) {
      expect(CREDIT_PACKS_MAP[pack.id]).toBe(pack.credits);
    }
  });

  it("has same number of entries as packs", () => {
    expect(Object.keys(CREDIT_PACKS_MAP)).toHaveLength(CREDIT_PACKS.length);
  });
});
