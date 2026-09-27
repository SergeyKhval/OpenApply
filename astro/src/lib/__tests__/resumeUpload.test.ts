import { describe, it, expect } from "vitest";
import { resumeUploadLabel } from "../resumeUpload";

describe("resumeUploadLabel", () => {
  it("shows 'Upload PDF' before anything is uploaded", () => {
    expect(
      resumeUploadLabel({ isReadingPdf: false, resumeSource: "paste", fileName: null }),
    ).toBe("Upload PDF");
  });

  it("shows 'Reading PDF…' while a PDF is being parsed", () => {
    expect(
      resumeUploadLabel({ isReadingPdf: true, resumeSource: "paste", fileName: null }),
    ).toBe("Reading PDF…");
  });

  it("shows the uploaded file's name once parsing succeeds", () => {
    expect(
      resumeUploadLabel({ isReadingPdf: false, resumeSource: "pdf", fileName: "sergey-resume.pdf" }),
    ).toBe("sergey-resume.pdf");
  });

  it("reverts to 'Upload PDF' once the resume text is edited away from the PDF", () => {
    expect(
      resumeUploadLabel({ isReadingPdf: false, resumeSource: "paste", fileName: "sergey-resume.pdf" }),
    ).toBe("Upload PDF");
  });
});
