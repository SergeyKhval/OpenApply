// One input takes a job link or a pasted job description. Mirrors
// spa/src/lib/jobInput.ts; keep the two in step.

export const MIN_DESCRIPTION_CHARS = 200;
export const MAX_DESCRIPTION_CHARS = 15000;

// Sites the scraper can't read: they block bots or need a login. Their links
// skip the parse and go straight to asking for the description.
export type BlockedJobBoard = "linkedin" | "indeed";

export type JobInput =
  | { kind: "empty" }
  | { kind: "link"; url: string }
  | { kind: "text"; text: string }
  | { kind: "too-short" };

function httpUrlOrNull(value: string): string | null {
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

/**
 * The value as a web link, or null when it isn't one. People paste links
 * without a scheme ("linkedin.com/jobs/view/..."), so a bare domain counts.
 */
export function asJobLink(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  if (/^https?:\/\//i.test(trimmed)) return httpUrlOrNull(trimmed);
  if (!/^[\w-]+(\.[\w-]+)+(?:[/?#:]|$)/.test(trimmed)) return null;
  return httpUrlOrNull(`https://${trimmed}`);
}

export function classifyJobInput(value: string): JobInput {
  const trimmed = value.trim();
  if (!trimmed) return { kind: "empty" };
  const url = asJobLink(trimmed);
  if (url) return { kind: "link", url };
  if (trimmed.length < MIN_DESCRIPTION_CHARS) return { kind: "too-short" };
  return { kind: "text", text: trimmed.slice(0, MAX_DESCRIPTION_CHARS) };
}

/**
 * True for pasted text that should switch a one-line link input into a
 * description box: anything that isn't a link and has a line break or runs
 * long. A short word or two is left alone in case it's the start of a link.
 */
export function looksLikeDescription(pasted: string): boolean {
  const trimmed = pasted.trim();
  if (!trimmed || asJobLink(trimmed)) return false;
  return /\n/.test(trimmed) || trimmed.length >= 80;
}

export function blockedJobBoard(url: string): BlockedJobBoard | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (/(^|\.)linkedin\.com$/.test(host) && /\/jobs(\/|$)/.test(parsed.pathname)) return "linkedin";
  if (/(^|\.)indeed\.[a-z.]+$/.test(host)) return "indeed";
  return null;
}

const BOARD_NAMES: Record<BlockedJobBoard, string> = {
  linkedin: "LinkedIn",
  indeed: "Indeed",
};

export function blockedBoardMessage(board: BlockedJobBoard): string {
  return `${BOARD_NAMES[board]} blocks us from reading its job pages. Copy the description from the posting and paste it here. We'll keep the link.`;
}
