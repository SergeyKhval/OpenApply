// One shape for the resume match sheet, from the stored in-app match result
// (resumeJobMatches.matchResult).
import type { ResumeJobMatch } from "@/types";
import { plural } from "@/lib/plural";

export type RequirementStatus = "met" | "partly" | "missing";

export type MatchView = {
  score: number;
  verdict: string;
  summary: string;
  counts: Record<RequirementStatus, number>;
  countsLine: string;
  requirements: { label: string; status: RequirementStatus; evidence: string }[];
  fixes: string[];
};

// Blunt on purpose: a low score says so
export function verdictFor(score: number): string {
  if (score >= 75) return "Likely to pass the first screen";
  if (score >= 50) return "Could pass with a few fixes";
  return "Unlikely to pass as it is";
}

export function toMatchView(result: ResumeJobMatch["matchResult"]): MatchView {
  const skills = result.skills_comparison ?? {};
  const requirements = [
    ...(skills.matched_skills ?? []).map((skill) => ({ skill, status: "met" as const })),
    ...(skills.partially_matched_skills ?? []).map((skill) => ({ skill, status: "partly" as const })),
    ...(skills.missing_skills ?? []).map((skill) => ({ skill, status: "missing" as const })),
  ].map(({ skill, status }) => ({
    label: skill.skill,
    status,
    evidence: skill.evidence?.trim() || (status === "missing" ? "Not in your resume" : ""),
  }));

  const counts = { met: 0, partly: 0, missing: 0 };
  for (const requirement of requirements) counts[requirement.status] += 1;

  const parts = [`${counts.met} of ${plural(requirements.length, "requirement")} met`];
  if (counts.partly) parts.push(`${counts.partly} partly`);
  if (counts.missing) parts.push(`${counts.missing} missing`);

  const score = Math.round(result.match_summary?.overall_match_percent ?? 0);
  return {
    score,
    verdict: verdictFor(score),
    summary: result.match_summary?.summary ?? "",
    counts,
    countsLine: requirements.length ? parts.join(", ") : "",
    requirements,
    fixes: (result.recommendations?.improvement_areas ?? []).filter((fix) => fix.trim()),
  };
}

// Card line from the engine's requirements, must-haves only:
// "4 of 6 must-haves met, 1 partly, missing GraphQL". Empty when none are marked must-have.
export function mustHaveLine(requirements: { requirement: string; status: string; importance: string }[]): string {
  const mustHaves = requirements.filter((requirement) => requirement.importance === "must-have");
  if (!mustHaves.length) return "";
  const met = mustHaves.filter((requirement) => requirement.status === "matched").length;
  const partly = mustHaves.filter((requirement) => requirement.status === "partial").length;
  const missing = mustHaves.filter((requirement) => requirement.status === "missing").map((requirement) => requirement.requirement);

  const parts = [`${met} of ${plural(mustHaves.length, "must-have")} met`];
  if (partly) parts.push(`${partly} partly`);
  if (missing.length === 1 || missing.length === 2) parts.push(`missing ${missing.join(" and ")}`);
  else if (missing.length > 2) parts.push(`${missing.length} missing`);
  return parts.join(", ");
}
