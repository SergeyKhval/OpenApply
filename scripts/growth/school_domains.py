"""Classifies an email domain as a likely school/education institution.

Faria owns "OpenApply" as the name of a school-admissions platform, so a
chunk of our signups are people who searched "openapply login" looking for
Faria's product and landed on ours by mistake (see
rca-school-notice-2026-09-24.md in the growth-sprint vault). This is a
heuristic for metrics hygiene only: flag these so they can be reported
separately from real signups, never drop them, since the heuristic can
also misclassify a genuine user who happens to have a school email.

Keep this the single place either side of the stack decides "is this a
school domain": scripts/growth/metrics.py imports it directly, and
spa/src/lib/emailDomainType.ts mirrors the same rules for the SPA (a
TypeScript module can't import a Python one, so that file must be kept in
sync with this one by hand).
"""
import re

# Specific domains seen in real signups (or the sprint's baseline research)
# that don't follow a generic edu/ac/k12 suffix. Add to this set whenever
# metrics.py's "Email domains" output surfaces a new one.
KNOWN_SCHOOL_DOMAINS = {
    "icsz.ch",  # International Community School, Zurich
    "tisa.az",  # The International School of Azerbaijan
    # Added 2026-09-27 (oa-o6f, from research/activation-dropoff-2026-09-27.md):
    # obviously institutional by name, but each sits on a generic-looking
    # suffix (.org/.ch/.it/.com/.qa) with no edu/ac/sch/k12 marker.
    "aislusaka.org",  # American International School of Lusaka
    "iszl.ch",  # International School of Zug and Luzern
    "gh-is.org",  # Ghana International School
    "isnaples.it",  # International School Naples
    "montessorijapan.com",  # Montessori school network, Japan
    "canadianschool.it",  # a Canadian international school in Italy
    "qad.qfschools.qa",  # Qatar Academy Doha, part of the Qatar Foundation Schools network
}

_K12_LABEL = re.compile(r"^k12$")


def is_school_domain(domain: str) -> bool:
    domain = (domain or "").strip().lower()
    if not domain:
        return False
    if domain in KNOWN_SCHOOL_DOMAINS:
        return True

    labels = domain.split(".")
    last, second_last = labels[-1], labels[-2] if len(labels) >= 2 else None

    if last == "edu":
        return True
    if second_last in ("edu", "ac", "sch"):
        return True
    if any(_K12_LABEL.match(label) for label in labels):
        return True

    return False
