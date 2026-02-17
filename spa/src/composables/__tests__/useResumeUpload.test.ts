import { describe, it, expect } from "vitest";
import { validateFile } from "../useResumeUpload";

const createMockFile = (
  name: string,
  size: number,
  type: string,
): File => {
  const file = new File(["x".repeat(size)], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
};

const mockUser = { uid: "user-123" } as import("firebase/auth").User;

describe("validateFile", () => {
  it("rejects when no user", () => {
    const file = createMockFile("resume.pdf", 100, "application/pdf");
    const result = validateFile(file, null);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Sign in");
  });

  it("rejects when user is undefined", () => {
    const file = createMockFile("resume.pdf", 100, "application/pdf");
    const result = validateFile(file, undefined);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Sign in");
  });

  it("rejects non-PDF files", () => {
    const file = createMockFile("resume.docx", 100, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    const result = validateFile(file, mockUser);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("PDF");
  });

  it("rejects files over 500KB", () => {
    const file = createMockFile("resume.pdf", 500 * 1024 + 1, "application/pdf");
    const result = validateFile(file, mockUser);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("500 KB");
  });

  it("accepts valid PDF under 500KB", () => {
    const file = createMockFile("resume.pdf", 100 * 1024, "application/pdf");
    const result = validateFile(file, mockUser);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("accepts PDF exactly at 500KB", () => {
    const file = createMockFile("resume.pdf", 500 * 1024, "application/pdf");
    const result = validateFile(file, mockUser);
    expect(result.valid).toBe(true);
  });
});
