// @vitest-environment node
import { describe, expect, it } from "vitest";
import fixture from "../../shared/jobSignalsCases.json";
import { signLines } from "../src/signs.js";

// Same cases as spa/src/lib/__tests__/jobSignals.test.ts: popup and app word signs alike
describe("signLines", () => {
  it.each(fixture.cases.map((entry) => [entry.name, entry]))("%s", (_name, { doc, company, lines }) => {
    expect(signLines(doc, company, new Date(...fixture.now))).toEqual(lines);
  });

  it("never words a verdict", () => {
    const text = JSON.stringify(fixture.cases.map((entry) => entry.lines));
    expect(text).not.toMatch(/ghost|scam|fake|likely|fraud|suspicious/i);
  });
});
