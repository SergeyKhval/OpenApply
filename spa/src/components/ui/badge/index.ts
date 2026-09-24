import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";

export { default as Badge } from "./Badge.vue";

export const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border border-transparent h-6 px-2.5 text-xs font-semibold w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:ring-ring/40 focus-visible:ring-[3px] aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive: "bg-destructive-soft text-destructive",
        outline: "border-input text-foreground [a&]:hover:bg-muted",
        success: "bg-success-soft text-success",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);
export type BadgeVariants = VariantProps<typeof badgeVariants>;

// Job stage colors (Saved, Applied, Interviewing, Offer, Closed)
export const stageBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full h-7 px-3 text-[13px] font-semibold whitespace-nowrap",
  {
    variants: {
      stage: {
        saved: "bg-stage-saved-soft text-stage-saved-text",
        applied: "bg-stage-applied-soft text-stage-applied-text",
        interviewing: "bg-stage-interviewing-soft text-stage-interviewing-text",
        offer: "bg-stage-offer-soft text-stage-offer-text",
        closed: "bg-stage-closed-soft text-stage-closed-text",
      },
    },
    defaultVariants: {
      stage: "saved",
    },
  },
);
export type StageBadgeVariants = VariantProps<typeof stageBadgeVariants>;
