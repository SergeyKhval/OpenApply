import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import {
  AllowanceProfile,
  AllowanceState,
  consumeAiCheck,
  getAllowanceState,
} from "./aiAllowance";

const billingProfileRef = (userId: string) =>
  getFirestore()
    .collection("users")
    .doc(userId)
    .collection("billingProfile")
    .doc("profile");

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

function profileOrThrow(
  snapshot: FirebaseFirestore.DocumentSnapshot,
): AllowanceProfile {
  if (!snapshot.exists) {
    throw new HttpsError("failed-precondition", "Billing profile not found");
  }
  return snapshot.data() as AllowanceProfile;
}

/**
 * Cheap pre-check before calling the model, so an exhausted user doesn't
 * cost us a generation. chargeAiCheck is the authoritative check.
 */
export async function assertAiAllowance(
  userId: string,
  now = new Date(),
): Promise<void> {
  const profile = profileOrThrow(await billingProfileRef(userId).get());
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
  const profile = profileOrThrow(await transaction.get(ref));
  const update = consumeAiCheck(profile, now);

  if (!update) {
    throw aiLimitReachedError(getAllowanceState(profile, now));
  }

  transaction.update(ref, {
    ...update,
    updatedAt: FieldValue.serverTimestamp(),
  });
}
