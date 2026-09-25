// Email preferences on users/{uid}.emailPrefs. The Monday summary is on by
// default; only an explicit false turns it off.
export type EmailPrefs = { weeklyDigest: boolean };

type UserData = { emailPrefs?: { weeklyDigest?: unknown } } | undefined;

export const wantsWeeklyDigest = (user: UserData) => user?.emailPrefs?.weeklyDigest !== false;

export function parseEmailPrefs(input: unknown): EmailPrefs {
  const weeklyDigest = (input as { weeklyDigest?: unknown } | null | undefined)?.weeklyDigest;
  if (typeof weeklyDigest !== "boolean") throw new Error("weeklyDigest must be true or false");
  return { weeklyDigest };
}
