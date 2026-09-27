// Classifies an email's domain as a likely school/education institution.
//
// Faria owns "OpenApply" as the name of a school-admissions platform, so a
// chunk of our signups are people who searched "openapply login" looking for
// Faria's product and landed on ours by mistake (see
// rca-school-notice-2026-09-24.md in the growth-sprint vault). This is a
// heuristic for analytics only: it can misclassify a genuine user who
// happens to have a school email, so callers should report "school" as a
// separate segment, never drop those users.
//
// Mirrors scripts/growth/school_domains.py's rules. A TypeScript module can't
// import a Python one, so keep the two in sync by hand.

// Specific domains seen in real signups (or the sprint's baseline research)
// that don't follow a generic edu/ac/k12 suffix. Add to this set whenever a
// new one turns up in scripts/growth/metrics.py's "Email domains" output.
const KNOWN_SCHOOL_DOMAINS = new Set([
  "icsz.ch", // International Community School, Zurich
  "tisa.az", // The International School of Azerbaijan
  // Added 2026-09-27 (oa-o6f, from research/activation-dropoff-2026-09-27.md):
  // obviously institutional by name, but each sits on a generic-looking
  // suffix (.org/.ch/.it/.com/.qa) with no edu/ac/sch/k12 marker.
  "aislusaka.org", // American International School of Lusaka
  "iszl.ch", // International School of Zug and Luzern
  "gh-is.org", // Ghana International School
  "isnaples.it", // International School Naples
  "montessorijapan.com", // Montessori school network, Japan
  "canadianschool.it", // a Canadian international school in Italy
  "qad.qfschools.qa", // Qatar Academy Doha, part of the Qatar Foundation Schools network
]);

export type EmailDomainType = "school" | "other";

export function classifyEmailDomain(email: string | null | undefined): EmailDomainType {
  const domain = (email ?? "").split("@")[1]?.trim().toLowerCase();
  if (!domain) return "other";
  if (KNOWN_SCHOOL_DOMAINS.has(domain)) return "school";

  const labels = domain.split(".");
  const last = labels[labels.length - 1];
  const secondLast = labels.length >= 2 ? labels[labels.length - 2] : undefined;

  if (last === "edu") return "school";
  if (secondLast === "edu" || secondLast === "ac" || secondLast === "sch") return "school";
  if (labels.includes("k12")) return "school";

  return "other";
}
