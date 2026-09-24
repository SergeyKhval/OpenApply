// Monthly AI allowance rules. Mirrors functions/src/lib/aiAllowance.ts (display rules only); keep in sync.

export const FREE_MONTHLY_CHECKS = 15;
export const PRO_MONTHLY_CHECKS = 150;
export const PRO_WARNING_THRESHOLD = 120;
// Coin balances from before the allowance become one-off bonus checks,
// capped so test/admin accounts don't turn into thousands of checks.
export const LEGACY_BONUS_CAP_COINS = 200;
const LEGACY_COINS_PER_CHECK = 10;
// past_due keeps Pro during Stripe's payment retries.
const PRO_STATUSES = new Set(["active", "trialing", "past_due"]);

export type AiUsage = { period: string; count: number };

export type AllowanceProfile = {
  aiUsage?: AiUsage | null;
  bonusChecks?: number | null;
  currentBalance?: number | null;
  subscriptionStatus?: string | null;
};

export type AllowanceState = {
  plan: "free" | "pro";
  limit: number;
  used: number;
  remaining: number;
  bonusChecks: number;
  canUse: boolean;
  resetsAt: Date;
};

export const usagePeriod = (now: Date) => now.toISOString().slice(0, 7);

export const nextResetDate = (now: Date) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

export const isProStatus = (status?: string | null) =>
  !!status && PRO_STATUSES.has(status);

export function bonusChecksOf(
  profile: AllowanceProfile | null | undefined,
): number {
  if (typeof profile?.bonusChecks === "number") {
    return Math.max(0, profile.bonusChecks);
  }
  const coins = Math.min(
    Math.max(profile?.currentBalance ?? 0, 0),
    LEGACY_BONUS_CAP_COINS,
  );
  return Math.floor(coins / LEGACY_COINS_PER_CHECK);
}

export function getAllowanceState(
  profile: AllowanceProfile | null | undefined,
  now: Date,
): AllowanceState {
  const plan = isProStatus(profile?.subscriptionStatus) ? "pro" : "free";
  const limit = plan === "pro" ? PRO_MONTHLY_CHECKS : FREE_MONTHLY_CHECKS;
  const usage = profile?.aiUsage;
  const used = usage?.period === usagePeriod(now) ? usage.count : 0;
  const remaining = Math.max(0, limit - used);
  const bonusChecks = bonusChecksOf(profile);

  return {
    plan,
    limit,
    used,
    remaining,
    bonusChecks,
    canUse: remaining + bonusChecks > 0,
    resetsAt: nextResetDate(now),
  };
}
