import { describe, it, expect } from "vitest";
import { parseStoragePath } from "../parsing";

describe("parseStoragePath", () => {
  // Business rule: only files in resumes/ directory should be processed
  it("extracts userId and fileName from valid path with timestamp", () => {
    const result = parseStoragePath("resumes/user123/1234567890-resume.pdf");
    expect(result).toEqual({ userId: "user123", fileName: "resume.pdf" });
  });

  it("handles fileName with multiple dashes", () => {
    const result = parseStoragePath("resumes/user123/1234567890-my-resume-v2.pdf");
    expect(result).toEqual({ userId: "user123", fileName: "my-resume-v2.pdf" });
  });

  // Documents behavior: first segment before dash is treated as timestamp
  it("strips first dash-segment as timestamp even if not numeric", () => {
    const result = parseStoragePath("resumes/user123/no-dash-filename.pdf");
    expect(result).toEqual({ userId: "user123", fileName: "dash-filename.pdf" });
  });

  it("throws for paths outside resumes/ directory", () => {
    expect(() => parseStoragePath("other/path/file.pdf")).toThrow();
  });

  it("throws for empty string", () => {
    expect(() => parseStoragePath("")).toThrow();
  });

  // Edge case: filename without timestamp dash should throw rather than return empty fileName
  it("throws when filename has no timestamp dash", () => {
    expect(() => parseStoragePath("resumes/user123/nodash")).toThrow();
  });
});
