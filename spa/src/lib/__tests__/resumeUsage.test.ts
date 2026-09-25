import { describe, expect, it } from "vitest";
import type { JobApplication } from "@/types";
import { countResumeUsage, formatFileSize, usageLabel } from "../resumeUsage";

const job = (resumeId?: string | null) => ({ resumeId }) as unknown as JobApplication;

describe("countResumeUsage", () => {
  it("counts jobs per resume and ignores jobs without one", () => {
    const usage = countResumeUsage([job("a"), job("a"), job("b"), job(null), job(undefined)]);
    expect(usage.get("a")).toBe(2);
    expect(usage.get("b")).toBe(1);
    expect(usage.size).toBe(2);
  });
});

describe("usageLabel", () => {
  it("speaks plainly", () => {
    expect(usageLabel(0)).toBe("Not used yet");
    expect(usageLabel(1)).toBe("Used in 1 job");
    expect(usageLabel(6)).toBe("Used in 6 jobs");
  });
});

describe("formatFileSize", () => {
  it("rounds to whole units", () => {
    expect(formatFileSize(88064)).toBe("86 KB");
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe("2.5 MB");
    expect(formatFileSize(undefined)).toBe("");
  });
});
