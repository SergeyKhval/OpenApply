import { describe, it, expect } from "vitest";
import { categorizeApplications } from "../lib/digest";
import type { DigestApplication, DigestInterview } from "../lib/digest";

const NOW = new Date("2024-06-15T12:00:00Z");

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

function daysFromNow(days: number): Date {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);
}

function makeApp(overrides: Partial<DigestApplication> & { status: string }): DigestApplication {
  return {
    id: "app-1",
    companyName: "Acme Corp",
    position: "Engineer",
    updatedAt: daysAgo(0),
    createdAt: daysAgo(30),
    ...overrides,
  };
}

describe("categorizeApplications — threshold categorization", () => {
  it("flags offered applications after 3 days as decision-needed", () => {
    const app = makeApp({ status: "offered", updatedAt: daysAgo(4) });
    const result = categorizeApplications([app], [], NOW);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].category).toBe("decision-needed");
    expect(result.actions[0].daysSinceActivity).toBe(4);
  });

  it("does not flag offered applications within 3 days", () => {
    const app = makeApp({ status: "offered", updatedAt: daysAgo(2) });
    const result = categorizeApplications([app], [], NOW);
    const decisionItems = result.actions.filter((a) => a.category === "decision-needed");
    expect(decisionItems).toHaveLength(0);
  });

  it("flags interviewing applications after 5 days with no upcoming interview as needs-attention", () => {
    const app = makeApp({ status: "interviewing", updatedAt: daysAgo(6) });
    const result = categorizeApplications([app], [], NOW);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].category).toBe("needs-attention");
    expect(result.actions[0].daysSinceActivity).toBe(6);
  });

  it("does not flag interviewing if a future interview is scheduled", () => {
    const app = makeApp({ id: "app-2", status: "interviewing", updatedAt: daysAgo(6) });
    const interview: DigestInterview = {
      applicationId: "app-2",
      conductedAt: daysFromNow(2),
      status: "pending",
    };
    const result = categorizeApplications([app], [interview], NOW);
    expect(result.actions).toHaveLength(0);
  });

  it("flags interviewing applications after 14 days as consider-archiving", () => {
    const app = makeApp({ status: "interviewing", updatedAt: daysAgo(15) });
    const result = categorizeApplications([app], [], NOW);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].category).toBe("consider-archiving");
    expect(result.actions[0].daysSinceActivity).toBe(15);
  });

  it("flags applied applications after 10 days as follow-up", () => {
    const app = makeApp({ status: "applied", updatedAt: daysAgo(11) });
    const result = categorizeApplications([app], [], NOW);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].category).toBe("follow-up");
    expect(result.actions[0].daysSinceActivity).toBe(11);
  });

  it("flags applied applications after 30 days as consider-archiving", () => {
    const app = makeApp({ status: "applied", updatedAt: daysAgo(31) });
    const result = categorizeApplications([app], [], NOW);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].category).toBe("consider-archiving");
    expect(result.actions[0].daysSinceActivity).toBe(31);
  });

  it("flags draft applications after 7 days as stale-draft (uses createdAt)", () => {
    // updatedAt is recent, but createdAt is old — should use createdAt
    const app = makeApp({ status: "draft", updatedAt: daysAgo(1), createdAt: daysAgo(8) });
    const result = categorizeApplications([app], [], NOW);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].category).toBe("stale-draft");
    expect(result.actions[0].daysSinceActivity).toBe(8);
  });

  it("ignores hired, rejected, and archived applications (no actions)", () => {
    const hired = makeApp({ id: "h", status: "hired", updatedAt: daysAgo(20) });
    const rejected = makeApp({ id: "r", status: "rejected", updatedAt: daysAgo(20) });
    const archived = makeApp({ id: "a", status: "archived", updatedAt: daysAgo(20) });
    const result = categorizeApplications([hired, rejected, archived], [], NOW);
    expect(result.actions).toHaveLength(0);
  });

  it("returns isEmpty true when no actions and no wins", () => {
    const app = makeApp({ status: "applied", updatedAt: daysAgo(2) });
    const result = categorizeApplications([app], [], NOW);
    expect(result.isEmpty).toBe(true);
    expect(result.wins).toHaveLength(0);
    expect(result.actions).toHaveLength(0);
  });
});

describe("categorizeApplications — exact threshold boundaries", () => {
  it("flags offered at exactly 3 days as decision-needed", () => {
    const app = makeApp({ status: "offered", updatedAt: daysAgo(3) });
    const result = categorizeApplications([app], [], NOW);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].category).toBe("decision-needed");
    expect(result.actions[0].daysSinceActivity).toBe(3);
  });

  it("flags interviewing at exactly 5 days with no future interview as needs-attention", () => {
    const app = makeApp({ status: "interviewing", updatedAt: daysAgo(5) });
    const result = categorizeApplications([app], [], NOW);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].category).toBe("needs-attention");
    expect(result.actions[0].daysSinceActivity).toBe(5);
  });

  it("flags interviewing at exactly 14 days as consider-archiving", () => {
    const app = makeApp({ status: "interviewing", updatedAt: daysAgo(14) });
    const result = categorizeApplications([app], [], NOW);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].category).toBe("consider-archiving");
    expect(result.actions[0].daysSinceActivity).toBe(14);
  });

  it("flags applied at exactly 10 days as follow-up", () => {
    const app = makeApp({ status: "applied", updatedAt: daysAgo(10) });
    const result = categorizeApplications([app], [], NOW);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].category).toBe("follow-up");
    expect(result.actions[0].daysSinceActivity).toBe(10);
  });

  it("flags applied at exactly 30 days as consider-archiving", () => {
    const app = makeApp({ status: "applied", updatedAt: daysAgo(30) });
    const result = categorizeApplications([app], [], NOW);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].category).toBe("consider-archiving");
    expect(result.actions[0].daysSinceActivity).toBe(30);
  });

  it("flags draft at exactly 7 days as stale-draft", () => {
    const app = makeApp({ status: "draft", updatedAt: daysAgo(1), createdAt: daysAgo(7) });
    const result = categorizeApplications([app], [], NOW);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].category).toBe("stale-draft");
    expect(result.actions[0].daysSinceActivity).toBe(7);
  });
});

describe("categorizeApplications — wins detection", () => {
  it("detects new applications submitted this week", () => {
    const app = makeApp({ status: "applied", createdAt: daysAgo(3), updatedAt: daysAgo(3) });
    const result = categorizeApplications([app], [], NOW);
    const newAppWins = result.wins.filter((w) => w.type === "new-application");
    expect(newAppWins).toHaveLength(1);
    expect(newAppWins[0].companyName).toBe("Acme Corp");
  });

  it("does not count drafts as new applications", () => {
    const app = makeApp({ status: "draft", createdAt: daysAgo(2), updatedAt: daysAgo(2) });
    const result = categorizeApplications([app], [], NOW);
    const newAppWins = result.wins.filter((w) => w.type === "new-application");
    expect(newAppWins).toHaveLength(0);
  });

  it("detects offers received this week", () => {
    const app = makeApp({ status: "offered", updatedAt: daysAgo(2), createdAt: daysAgo(40) });
    const result = categorizeApplications([app], [], NOW);
    const offerWins = result.wins.filter((w) => w.type === "offer-received");
    expect(offerWins).toHaveLength(1);
    expect(offerWins[0].companyName).toBe("Acme Corp");
  });

  it("detects applications that moved forward this week", () => {
    // createdAt is older than 7 days, updatedAt is recent, status is interviewing
    const app = makeApp({
      status: "interviewing",
      updatedAt: daysAgo(3),
      createdAt: daysAgo(20),
    });
    const result = categorizeApplications([app], [], NOW);
    const movedForward = result.wins.filter((w) => w.type === "moved-forward");
    expect(movedForward).toHaveLength(1);
    expect(movedForward[0].companyName).toBe("Acme Corp");
  });

  it("detects hired this week as moved-forward win without generating actions", () => {
    const app = makeApp({
      status: "hired",
      updatedAt: daysAgo(2),
      createdAt: daysAgo(60),
    });
    const result = categorizeApplications([app], [], NOW);
    // Should appear as a win
    const movedForward = result.wins.filter((w) => w.type === "moved-forward");
    expect(movedForward).toHaveLength(1);
    expect(movedForward[0].companyName).toBe("Acme Corp");
    // Should NOT generate any action items
    expect(result.actions).toHaveLength(0);
  });
});
