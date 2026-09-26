// A small resume in pdf-parse shape, shared by the tailor tests
export const RESUME = `Sarah Chen
sarah.chen@example.com · Portland, OR
Summary
Frontend engineer who ships accessible web apps with a small team.
Experience
Frontend Engineer, Northwind Software
Mar 2019 – Present
• Built the core web app in React with TypeScript across the codebase.
• Helped with the migration of legacy screens off ad-hoc state to Redux.
• Integrated REST APIs for billing and search, handling pagination
and error states.
• Raised test coverage from 40% to 85% with Jest.
• Organized the team's weekly demo.
Junior Developer, Acme Corp
2016 – 2019
• Maintained Postgres queries for the reporting dashboard.
• Mentored two interns on code review.
-- 1 of 2 --
Skills
React, TypeScript, Redux, Jest
Education
B.S. Computer Science, Portland State University`;

export const ANALYSIS = {
  companyName: "Globex",
  position: "Senior Frontend Engineer",
  matchScore: 70,
  parseCheck: { status: "clean" as const, note: "" },
  requirements: [
    { requirement: "Expert React", status: "matched" as const, importance: "must-have" as const, evidence: "Built the core web app in React with TypeScript across the codebase." },
    { requirement: "REST API integration", status: "matched" as const, importance: "must-have" as const, evidence: "Integrated REST APIs for billing and search" },
    { requirement: "Kubernetes", status: "missing" as const, importance: "must-have" as const, evidence: "" },
    { requirement: "PostgreSQL", status: "partial" as const, importance: "nice-to-have" as const, evidence: "Maintained Postgres queries for the reporting dashboard." },
    { requirement: "Led a team", status: "missing" as const, importance: "nice-to-have" as const, evidence: "" },
  ],
  missingKeywords: ["Kubernetes", "GraphQL", "Next.js"],
  fixes: [{ gap: "PostgreSQL", where: "Maintained Postgres queries", action: "Name PostgreSQL" }],
  technologies: ["React", "TypeScript", "PostgreSQL", "Kubernetes", "GraphQL", "Redux"],
};
