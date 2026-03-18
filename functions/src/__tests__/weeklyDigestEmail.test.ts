import { describe, it, expect } from "vitest";
import { renderWeeklyDigest, DigestEmailData } from "../emails/WeeklyDigest";

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

describe("renderWeeklyDigest", () => {
  it("includes greeting text based on tier", async () => {
    const html = await renderWeeklyDigest(fullData);
    expect(html).toContain("Great week!");
  });

  it("includes summary line", async () => {
    const html = await renderWeeklyDigest(fullData);
    expect(html).toContain("a quick look");
  });

  it("renders stats widget with counts", async () => {
    const html = await renderWeeklyDigest(fullData);
    expect(html).toContain("New Apps");
    expect(html).toContain("Interviews");
    expect(html).toContain("Offers");
  });

  it("renders action cards with nudge copy", async () => {
    const html = await renderWeeklyDigest(fullData);
    expect(html).toContain("OldCorp");
    expect(html).toContain("Designer");
    expect(html).toContain("Offer received 4 days ago");
    expect(html).toContain("Respond to offer");
    expect(html).toContain("SlowInc");
    expect(html).toContain("Applied 12 days ago");
    expect(html).toContain("Follow up");
  });

  it("includes application links with correct IDs", async () => {
    const html = await renderWeeklyDigest(fullData);
    expect(html).toContain(`${APP_URL}/id-1`);
    expect(html).toContain(`${APP_URL}/id-2`);
  });

  it("renders priority dots with correct colors", async () => {
    const html = await renderWeeklyDigest(fullData);
    expect(html).toContain("#ef4444"); // red for decision-needed
    expect(html).toContain("#3b82f6"); // blue for follow-up
  });

  it("shows CTA button when totalActionCount exceeds 3", async () => {
    const html = await renderWeeklyDigest(overflowData);
    expect(html).toContain("View all applications");
  });

  it("hides CTA button when totalActionCount is 3 or fewer", async () => {
    const html = await renderWeeklyDigest(fullData);
    expect(html).not.toContain("View all applications");
  });

  it("shows check-in greeting for no-wins tier", async () => {
    const html = await renderWeeklyDigest(checkInData);
    expect(html).toContain("Your weekly check-in");
  });

  it("shows keep-it-up greeting", async () => {
    const keepItUpData: DigestEmailData = { ...fullData, greeting: "keep-it-up" };
    const html = await renderWeeklyDigest(keepItUpData);
    expect(html).toContain("Keep it up!");
  });

  it("includes receiving notice", async () => {
    const html = await renderWeeklyDigest(fullData);
    expect(html).toContain("Your weekly job search update");
  });

  it("renders needs your attention header", async () => {
    const html = await renderWeeklyDigest(fullData);
    expect(html.toLowerCase()).toContain("needs your attention");
  });
});
