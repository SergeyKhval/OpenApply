import type { CoverLetterStyle } from "@/composables/useCoverLetters";

export const LENGTH_OPTIONS: { value: CoverLetterStyle["length"]; label: string }[] = [
  { value: "short", label: "Short" },
  { value: "standard", label: "Standard" },
];

export const TONE_OPTIONS: { value: CoverLetterStyle["tone"]; label: string }[] = [
  { value: "plain", label: "Plain" },
  { value: "warm", label: "Warm" },
];
