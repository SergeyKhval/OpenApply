import { describe, expect, it } from "vitest";
import type { JobStatus } from "@/types";
import {
  closedReason,
  isOpenStage,
  STAGE_LABELS,
  stageOf,
  statusForStage,
} from "../stages";

const ALL_STATUSES: JobStatus[] = [
  "draft",
  "applied",
  "interviewing",
  "offered",
  "hired",
  "rejected",
  "withdrew",
  "archived",
];

describe("stages", () => {
  it("maps stored statuses to board stages without changing stored values", () => {
    expect(stageOf("draft")).toBe("saved");
    expect(stageOf("applied")).toBe("applied");
    expect(stageOf("interviewing")).toBe("interviewing");
    expect(stageOf("offered")).toBe("offer");
  });

  it("puts hired, rejected, withdrew and archived under Closed with a reason", () => {
    for (const status of ["hired", "rejected", "withdrew", "archived"] as const) {
      expect(stageOf(status)).toBe("closed");
      expect(closedReason(status)).toBe(status);
    }
    expect(closedReason("applied")).toBeNull();
  });

  it("every status has a stage and a label", () => {
    for (const status of ALL_STATUSES) {
      expect(STAGE_LABELS[stageOf(status)]).toBeTruthy();
    }
  });

  it("an unknown stored status still shows up (as Saved), never disappears", () => {
    expect(stageOf("something-new" as JobStatus)).toBe("saved");
  });

  it("maps open stages back to stored statuses", () => {
    expect(statusForStage("saved")).toBe("draft");
    expect(statusForStage("offer")).toBe("offered");
    expect(statusForStage("applied")).toBe("applied");
    expect(statusForStage("interviewing")).toBe("interviewing");
  });

  it("knows which stages are open", () => {
    expect(isOpenStage("applied")).toBe(true);
    expect(isOpenStage("closed")).toBe(false);
  });
});
