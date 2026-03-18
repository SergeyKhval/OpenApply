import { describe, it, expect } from "vitest";
import { buildDigestEmailHtml, buildDigestEmailText, DigestEmailData } from "../lib/digestEmail";

const APP_URL = "https://openapply.app/app/dashboard/applications";

const fullData: DigestEmailData = {
  greeting: "great-week",
  summaryLine: "You received 1 offer and submitted 1 new application this week. Here's a quick look at your job search this week.",
  stats: { newApps: 1, interviews: 0, offers: 1 },
  actions: [
    { applicationId: "id-1", companyName: "OldCorp", position: "Designer", category: "decision-needed", daysSinceActivity: 4 },
    { applicationId: "id-2", companyName: "SlowInc", position: "Engineer", category: "follow-up", daysSinceActivity: 12 },
  ],
  totalActionCount: 2,
  appUrl: APP_URL,
};

const checkInData: DigestEmailData = {
  greeting: "check-in",
  summaryLine: "No new activity this week, but a few applications could use your attention.",
  stats: { newApps: 0, interviews: 0, offers: 0 },
  actions: [
    { applicationId: "id-3", companyName: "Corp", position: "Dev", category: "stale-draft", daysSinceActivity: 8 },
  ],
  totalActionCount: 1,
  appUrl: APP_URL,
};

const overflowData: DigestEmailData = {
  ...fullData,
  totalActionCount: 5,
};

describe("buildDigestEmailHtml", () => {
  it("includes greeting text based on tier", () => {
    const html = buildDigestEmailHtml(fullData);
    expect(html).toContain("Great week!");
  });

  it("includes summary line", () => {
    const html = buildDigestEmailHtml(fullData);
    // Summary is HTML-escaped, so check for a key fragment
    expect(html).toContain("Here&#39;s a quick look");
  });

  it("renders stats widget with counts", () => {
    const html = buildDigestEmailHtml(fullData);
    expect(html).toContain("New Apps");
    expect(html).toContain("Interviews");
    expect(html).toContain("Offers");
  });

  it("renders action cards with nudge copy", () => {
    const html = buildDigestEmailHtml(fullData);
    expect(html).toContain("OldCorp");
    expect(html).toContain("Designer");
    expect(html).toContain("Offer received 4 days ago");
    expect(html).toContain("Respond to offer");
    expect(html).toContain("SlowInc");
    expect(html).toContain("Applied 12 days ago");
    expect(html).toContain("Follow up");
  });

  it("includes application links with correct IDs", () => {
    const html = buildDigestEmailHtml(fullData);
    expect(html).toContain(`${APP_URL}/id-1`);
    expect(html).toContain(`${APP_URL}/id-2`);
  });

  it("renders priority dots with correct colors", () => {
    const html = buildDigestEmailHtml(fullData);
    expect(html).toContain("#ef4444"); // red for decision-needed
    expect(html).toContain("#3b82f6"); // blue for follow-up
  });

  it("shows CTA button when totalActionCount exceeds 3", () => {
    const html = buildDigestEmailHtml(overflowData);
    expect(html).toContain("View all applications");
  });

  it("hides CTA button when totalActionCount is 3 or fewer", () => {
    const html = buildDigestEmailHtml(fullData);
    expect(html).not.toContain("View all applications");
  });

  it("shows check-in greeting for no-wins tier", () => {
    const html = buildDigestEmailHtml(checkInData);
    expect(html).toContain("Your weekly check-in");
  });

  it("shows keep-it-up greeting", () => {
    const keepItUpData: DigestEmailData = { ...fullData, greeting: "keep-it-up" };
    const html = buildDigestEmailHtml(keepItUpData);
    expect(html).toContain("Keep it up!");
  });

  it("includes receiving notice", () => {
    const html = buildDigestEmailHtml(fullData);
    expect(html).toContain("active job search on OpenApply");
  });

  it("renders needs your attention header", () => {
    const html = buildDigestEmailHtml(fullData);
    expect(html.toLowerCase()).toContain("needs your attention");
  });

  it("HTML-escapes company names and positions", () => {
    const xssData: DigestEmailData = {
      ...fullData,
      actions: [
        {
          applicationId: "xss-1",
          companyName: "<img src=x onerror=alert(1)>",
          position: "Dev & Tester",
          category: "follow-up",
          daysSinceActivity: 10,
        },
      ],
    };
    const html = buildDigestEmailHtml(xssData);
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&amp;");
  });
});

describe("buildDigestEmailText", () => {
  it("includes greeting and summary", () => {
    const text = buildDigestEmailText(fullData);
    expect(text).toContain("Great week!");
    expect(text).toContain(fullData.summaryLine);
  });

  it("includes stats line", () => {
    const text = buildDigestEmailText(fullData);
    expect(text).toContain("This week:");
    expect(text).toContain("1 new app");
    expect(text).toContain("1 offer");
  });

  it("includes numbered action list with nudges", () => {
    const text = buildDigestEmailText(fullData);
    expect(text).toContain("1. OldCorp (Designer)");
    expect(text).toContain("Offer received 4 days ago");
    expect(text).toContain(`${APP_URL}/id-1`);
    expect(text).toContain("2. SlowInc (Engineer)");
  });

  it("includes CTA line when overflow", () => {
    const text = buildDigestEmailText(overflowData);
    expect(text).toContain(`View all applications: ${APP_URL}`);
  });

  it("excludes CTA line when no overflow", () => {
    const text = buildDigestEmailText(fullData);
    expect(text).not.toContain("View all applications");
  });

  it("includes separator", () => {
    const text = buildDigestEmailText(fullData);
    expect(text).toContain("---");
  });

  it("does not contain HTML tags", () => {
    const text = buildDigestEmailText(fullData);
    expect(text).not.toMatch(/<[a-z]/i);
  });
});
