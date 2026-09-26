import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import {
  AllowanceProfile,
  AllowanceState,
  consumeAiCheck,
  getAllowanceState,
} from "./aiAllowance";
import { billingProfileRef, DEFAULT_BILLING_PROFILE } from "./billingProfile";

const formatResetDate = (date: Date) =>
  date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

export function aiLimitReachedError(state: AllowanceState): HttpsError {
  const checks =
    state.plan === "pro"
      ? `${state.limit} AI checks`
      : `${state.limit} free AI checks`;

  return new HttpsError(
    "resource-exhausted",
    `You've used your ${checks} this month. They reset on ${formatResetDate(state.resetsAt)}.`,
    {
      code: "ai-limit-reached",
      plan: state.plan,
      limit: state.limit,
      resetsAt: state.resetsAt.toISOString(),
    },
  );
}

/**
 * A missing billing profile (Stripe outage at signup, or an account that
 * predates this self-heal) is treated as a fresh free tier rather than a
 * hard failure — AI allowance never depends on Stripe having succeeded.
 */
function profileOf(snapshot: FirebaseFirestore.DocumentSnapshot): AllowanceProfile {
  return (snapshot.exists ? snapshot.data() : DEFAULT_BILLING_PROFILE) as AllowanceProfile;
}

/**
 * Cheap pre-check before calling the model, so an exhausted user doesn't
 * cost us a generation. chargeAiCheck is the authoritative check.
 */
export async function assertAiAllowance(
  userId: string,
  now = new Date(),
): Promise<void> {
  const profile = profileOf(await billingProfileRef(userId).get());
  const state = getAllowanceState(profile, now);
  if (!state.canUse) {
    throw aiLimitReachedError(state);
  }
}

/**
 * Spends one AI check inside a transaction. Call it before any transaction
 * writes: Firestore requires all reads to happen first.
 */
export async function chargeAiCheck(
  transaction: FirebaseFirestore.Transaction,
  userId: string,
  now = new Date(),
): Promise<void> {
  const ref = billingProfileRef(userId);
  const snapshot = await transaction.get(ref);
  const profile = profileOf(snapshot);
  const update = consumeAiCheck(profile, now);

  if (!update) {
    throw aiLimitReachedError(getAllowanceState(profile, now));
  }

  if (snapshot.exists) {
    transaction.update(ref, {
      ...update,
      updatedAt: FieldValue.serverTimestamp(),
    });
  } else {
    transaction.set(ref, {
      ...DEFAULT_BILLING_PROFILE,
      ...update,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}
