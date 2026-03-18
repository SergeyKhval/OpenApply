import { describe, it, expect } from "vitest";
import { buildDigestEmailHtml, buildDigestEmailText } from "../lib/digestEmail";
import { DigestResult } from "../lib/digest";

const APP_URL = "https://openapply.app/app/dashboard/applications";

const fullDigest: DigestResult = {
  wins: [
    { companyName: "Acme", position: "Developer", type: "new-application" },
    { companyName: "BigCo", position: "PM", type: "offer-received" },
  ],
  actions: [
    { applicationId: "id-1", companyName: "OldCorp", position: "Designer", category: "decision-needed", daysSinceActivity: 4 },
    { applicationId: "id-2", companyName: "SlowInc", position: "Engineer", category: "follow-up", daysSinceActivity: 12 },
  ],
  isEmpty: false,
};

const noWinsDigest: DigestResult = {
  wins: [],
  actions: [
    { applicationId: "id-3", companyName: "Corp", position: "Dev", category: "stale-draft", daysSinceActivity: 8 },
  ],
  isEmpty: false,
};

describe("buildDigestEmailHtml", () => {
  it("includes wins section when wins exist", () => {
    const html = buildDigestEmailHtml(fullDigest, APP_URL);
    expect(html).toContain("Acme");
    expect(html).toContain("Developer");
    expect(html).toContain("BigCo");
    expect(html).toContain("PM");
    expect(html).toContain("New application");
    expect(html).toContain("Offer received");
  });

  it("omits wins section when no wins", () => {
    const html = buildDigestEmailHtml(noWinsDigest, APP_URL);
    expect(html).not.toContain("New application");
    expect(html).not.toContain("Offer received");
    expect(html).not.toContain("Moved forward");
  });

  it("includes application links with correct IDs", () => {
    const html = buildDigestEmailHtml(fullDigest, APP_URL);
    expect(html).toContain(`${APP_URL}/id-1`);
    expect(html).toContain(`${APP_URL}/id-2`);
  });

  it("includes days since activity", () => {
    const html = buildDigestEmailHtml(fullDigest, APP_URL);
    expect(html).toContain("4 days");
    expect(html).toContain("12 days");
  });

  it("includes receiving notice", () => {
    const html = buildDigestEmailHtml(fullDigest, APP_URL);
    expect(html).toContain("active job search on OpenApply");
  });

  it("groups actions by category", () => {
    const html = buildDigestEmailHtml(fullDigest, APP_URL);
    expect(html).toContain("Offers Awaiting Decision");
    expect(html).toContain("Follow Up on Applications");
  });

  it("HTML-escapes company names and positions", () => {
    const xssDigest: DigestResult = {
      wins: [{ companyName: "<script>alert(1)</script>", position: 'A&B "Corp"', type: "new-application" }],
      actions: [
        {
          applicationId: "xss-1",
          companyName: "<img src=x onerror=alert(1)>",
          position: "Dev & Tester",
          category: "follow-up",
          daysSinceActivity: 10,
        },
      ],
      isEmpty: false,
    };
    const html = buildDigestEmailHtml(xssDigest, APP_URL);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
  });

  it("renders category sections in correct order", () => {
    const orderedDigest: DigestResult = {
      wins: [],
      actions: [
        { applicationId: "a1", companyName: "A", position: "P", category: "consider-archiving", daysSinceActivity: 30 },
        { applicationId: "a2", companyName: "B", position: "Q", category: "decision-needed", daysSinceActivity: 5 },
        { applicationId: "a3", companyName: "C", position: "R", category: "follow-up", daysSinceActivity: 11 },
      ],
      isEmpty: false,
    };
    const html = buildDigestEmailHtml(orderedDigest, APP_URL);
    const decisionIdx = html.indexOf("Offers Awaiting Decision");
    const followUpIdx = html.indexOf("Follow Up on Applications");
    const archiveIdx = html.indexOf("Consider Archiving");
    expect(decisionIdx).toBeGreaterThan(-1);
    expect(followUpIdx).toBeGreaterThan(-1);
    expect(archiveIdx).toBeGreaterThan(-1);
    expect(decisionIdx).toBeLessThan(followUpIdx);
    expect(followUpIdx).toBeLessThan(archiveIdx);
  });
});

describe("buildDigestEmailText", () => {
  it("returns plain text version with application details", () => {
    const text = buildDigestEmailText(fullDigest, APP_URL);
    expect(text).toContain("OldCorp");
    expect(text).toContain("Designer");
    expect(text).toContain(`${APP_URL}/id-1`);
    expect(text).toContain("SlowInc");
    expect(text).toContain("Engineer");
    expect(text).toContain(`${APP_URL}/id-2`);
  });

  it("includes wins in plain text", () => {
    const text = buildDigestEmailText(fullDigest, APP_URL);
    expect(text).toContain("Acme");
    expect(text).toContain("Developer");
    expect(text).toContain("New application");
    expect(text).toContain("Offer received");
  });

  it("omits wins section when no wins in plain text", () => {
    const text = buildDigestEmailText(noWinsDigest, APP_URL);
    expect(text).not.toContain("New application");
    expect(text).not.toContain("Offer received");
  });

  it("includes days since activity in plain text", () => {
    const text = buildDigestEmailText(fullDigest, APP_URL);
    expect(text).toContain("4 days");
    expect(text).toContain("12 days");
  });

  it("includes separator in plain text", () => {
    const text = buildDigestEmailText(fullDigest, APP_URL);
    expect(text).toContain("---");
  });

  it("groups actions by category in plain text", () => {
    const text = buildDigestEmailText(fullDigest, APP_URL);
    expect(text).toContain("Offers Awaiting Decision");
    expect(text).toContain("Follow Up on Applications");
  });

  it("does not contain HTML tags in plain text", () => {
    const text = buildDigestEmailText(fullDigest, APP_URL);
    expect(text).not.toMatch(/<[a-z]/i);
  });
});
