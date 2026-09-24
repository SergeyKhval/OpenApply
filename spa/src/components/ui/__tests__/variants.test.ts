import { describe, expect, it } from "vitest";
import { buttonVariants } from "../button";
import { badgeVariants, stageBadgeVariants } from "../badge";

const PALETTE = /\b(purple|violet|indigo|fuchsia|zinc|slate|gray|neutral)-\d/;

describe("primitive variants", () => {
  it("buttons are pills with token colors", () => {
    expect(buttonVariants()).toContain("rounded-full");
    expect(buttonVariants()).toContain("text-primary-foreground");
    expect(buttonVariants({ variant: "destructive" })).toContain("text-destructive");
    expect(buttonVariants({ size: "icon" })).toContain("size-11");
    expect(buttonVariants({ size: "icon-sm" })).toContain("size-9");
  });

  it("uses no hard-coded palette colors", () => {
    const classes = [
      ...(["default", "secondary", "outline", "ghost", "destructive", "link"] as const).map(
        (variant) => buttonVariants({ variant }),
      ),
      ...(["default", "secondary", "outline", "destructive", "success"] as const).map(
        (variant) => badgeVariants({ variant }),
      ),
    ].join(" ");
    expect(classes).not.toMatch(PALETTE);
  });

  it("badges are pills", () => {
    expect(badgeVariants()).toContain("rounded-full");
    expect(badgeVariants({ variant: "success" })).toContain("text-success");
  });

  it("every stage has a badge style", () => {
    for (const stage of ["saved", "applied", "interviewing", "offer", "closed"] as const) {
      const classes = stageBadgeVariants({ stage });
      expect(classes).toContain(`bg-stage-${stage}-soft`);
      expect(classes).toContain(`text-stage-${stage}-text`);
    }
  });
});
