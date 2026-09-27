import { describe, expect, it } from "vitest";
import { classifyEmailDomain } from "../emailDomainType";

describe("classifyEmailDomain", () => {
  it.each([
    "student@eic.edu", // bare .edu, seen in real signups since 2026-09-23
    "admin@lincoln.edu.gh", // .edu.<country>, seen in the sprint's baseline research
    "teacher@aes.ac.in", // .ac.<country>, seen in real signups since 2026-09-23
    "person@some-college.ac.uk",
    "person@district.k12.ca.us", // US K-12 school district
    "person@k12.example.org", // "k12" as a label anywhere, not just before ca.us
    "person@school.sch.uk", // UK schools convention
    "person@icsz.ch", // known international school domain, no edu/ac/k12 marker
    "person@tisa.az", // known international school domain, no edu/ac/k12 marker
    "PERSON@EIC.EDU", // case insensitive
    "  person@eic.edu  ", // tolerate surrounding whitespace
  ])("flags %s as a school domain", (email) => {
    expect(classifyEmailDomain(email)).toBe("school");
  });

  it.each([
    "person@gmail.com",
    "person@openapply.app",
    "person@outlook.com",
    "person@myeducationcompany.com", // contains "edu" but not as its own label
    "person@academic-press.io", // contains "ac" but not as its own label
    "person@k12corp.com", // "k12" as a substring, not its own label
    null,
    undefined,
    "",
    "not-an-email",
  ])("does not flag %s as a school domain", (email) => {
    expect(classifyEmailDomain(email)).toBe("other");
  });
});
