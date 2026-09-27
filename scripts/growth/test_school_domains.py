import pytest

from school_domains import is_school_domain


@pytest.mark.parametrize(
    "domain",
    [
        "eic.edu",  # bare .edu, seen in real signups since 2026-09-23
        "lincoln.edu.gh",  # .edu.<country>, seen in the sprint's baseline research
        "aes.ac.in",  # .ac.<country>, seen in real signups since 2026-09-23
        "some-college.ac.uk",
        "district.k12.ca.us",  # US K-12 school district
        "k12.example.org",  # "k12" as a label anywhere, not just before ca.us
        "school.sch.uk",  # UK schools convention
        "icsz.ch",  # known international school domain, no edu/ac/k12 marker
        "tisa.az",  # known international school domain, no edu/ac/k12 marker
        "EIC.EDU",  # case insensitive
        "  eic.edu  ",  # tolerate surrounding whitespace
        "aislusaka.org",  # oa-o6f: institutional by name, .org suffix
        "iszl.ch",  # oa-o6f: institutional by name, bare .ch suffix
        "gh-is.org",  # oa-o6f: institutional by name, .org suffix
        "isnaples.it",  # oa-o6f: institutional by name, .it suffix
        "montessorijapan.com",  # oa-o6f: institutional by name, .com suffix
        "canadianschool.it",  # oa-o6f: institutional by name, .it suffix
        "qad.qfschools.qa",  # oa-o6f: institutional by name, .qa suffix
    ],
)
def test_flags_known_school_domains(domain):
    assert is_school_domain(domain) is True


@pytest.mark.parametrize(
    "domain",
    [
        "gmail.com",
        "openapply.app",
        "outlook.com",
        "myeducationcompany.com",  # contains "edu" but not as its own label
        "academic-press.io",  # contains "ac" but not as its own label
        "k12corp.com",  # "k12" as a substring, not its own label
        "",
        "none",
    ],
)
def test_does_not_flag_regular_domains(domain):
    assert is_school_domain(domain) is False
