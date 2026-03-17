import { describe, it, expect } from "vitest";
import { validateResumeForGeneration, validateJobApplicationForGeneration } from "../validation";

describe("validateResumeForGeneration", () => {
  // Business rule: AI features require parsed resume text — don't waste credits on empty input
  it("passes when text is present", () => {
    expect(() => validateResumeForGeneration({ text: "Resume content here..." })).not.toThrow();
  });

  it("throws when text is empty string", () => {
    expect(() => validateResumeForGeneration({ text: "" })).toThrow();
  });

  it("throws when text is null", () => {
    expect(() => validateResumeForGeneration({ text: null as any })).toThrow();
  });

  it("throws when text is undefined", () => {
    expect(() => validateResumeForGeneration({ text: undefined as any })).toThrow();
  });

  it("throws when text field is missing entirely", () => {
    expect(() => validateResumeForGeneration({} as any)).toThrow();
  });
});

describe("validateJobApplicationForGeneration", () => {
  const validApp = {
    companyName: "Acme Corp",
    position: "Senior Engineer",
    jobDescription: "We are looking for...",
  };

  // Business rule: all three fields are needed to produce a useful AI output
  it("passes when all fields are present", () => {
    expect(() => validateJobApplicationForGeneration(validApp)).not.toThrow();
  });

  it("throws when companyName is missing", () => {
    expect(() => validateJobApplicationForGeneration({ ...validApp, companyName: "" })).toThrow();
  });

  it("throws when position is missing", () => {
    expect(() => validateJobApplicationForGeneration({ ...validApp, position: "" })).toThrow();
  });

  it("throws when jobDescription is missing", () => {
    expect(() => validateJobApplicationForGeneration({ ...validApp, jobDescription: "" })).toThrow();
  });

  it("throws when jobDescription is undefined", () => {
    expect(() => validateJobApplicationForGeneration({ ...validApp, jobDescription: undefined as any })).toThrow();
  });
});
