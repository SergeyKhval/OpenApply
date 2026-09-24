import { randomBytes } from "node:crypto";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { getAuth, type UserRecord } from "firebase-admin/auth";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { Resend } from "resend";
import { getClientIp, hashClientKey } from "./lib/matchTool";
import {
  CODE_TTL_MS,
  INVALID_CODE_MESSAGE,
  MAX_ATTEMPTS,
  assertSendWithinLimits,
  buildSignInCodeEmail,
  codeMatches,
  generateCode,
  hashCode,
  normalizeCode,
  normalizeEmail,
  sendLimitDocIds,
  type SendCounts,
} from "./lib/signInCode";

const RESEND_API_KEY = defineString("RESEND_API_KEY");
const RATE_LIMIT_HASH_KEY = defineString("RATE_LIMIT_HASH_KEY", { default: "" });

const FROM_EMAIL = "OpenApply <sergey@openapply.app>";
// Counters only need to outlive their window; a Firestore TTL policy on
// expiresAt cleans them (and expired codes) up.
const LIMIT_COUNTER_TTL_MS = 2 * 24 * 60 * 60 * 1000;

const db = getFirestore();

type StoredCode = {
  codeHash: string;
  salt: string;
  attempts: number;
  expiresAt: Timestamp;
};

// Doc ids are keyed hashes so raw emails and IPs never land in Firestore
function emailKey(email: string) {
  return hashClientKey(`signin-email:${email}`, RATE_LIMIT_HASH_KEY.value() || undefined);
}

function ipKey(ip: string | null) {
  return hashClientKey(`signin-ip:${ip ?? "unknown"}`, RATE_LIMIT_HASH_KEY.value() || undefined);
}

function codeRef(email: string) {
  return db.collection("signInCodes").doc(emailKey(email));
}

async function deliverCode(email: string, code: string) {
  if (process.env.FUNCTIONS_EMULATOR === "true") {
    logger.info(`[emulator] sign-in code for ${email}: ${code}`);
    return;
  }

  const apiKey = RESEND_API_KEY.value();
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");

  const { subject, html, text } = buildSignInCodeEmail(code);
  const { error } = await new Resend(apiKey).emails.send({
    to: email,
    from: FROM_EMAIL,
    subject,
    html,
    text,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
}

/**
 * Emails a 6-digit sign-in code. Works the same whether or not an account
 * exists for the email (the account is found or created on verify), so the
 * response never reveals who has an account.
 */
export const sendSignInCode = onCall(
  { maxInstances: 5, concurrency: 40, cpu: 1, memory: "256MiB", timeoutSeconds: 30 },
  async (request) => {
    const email = normalizeEmail(request.data?.email);
    const now = Date.now();
    const code = generateCode();
    const salt = randomBytes(16).toString("hex");
    const codeHash = hashCode(code, salt);

    const limitIds = sendLimitDocIds(emailKey(email), ipKey(getClientIp(request.rawRequest)), new Date(now));
    const limitRefs = Object.entries(limitIds).map(
      ([counter, id]) => [counter, db.collection("signInCodeLimits").doc(id)] as const,
    );
    const ref = codeRef(email);

    await db.runTransaction(async (transaction) => {
      const snapshots = await Promise.all(limitRefs.map(([, limitRef]) => transaction.get(limitRef)));
      const counts = Object.fromEntries(
        limitRefs.map(([counter], index) => [counter, snapshots[index].data()?.count ?? 0]),
      ) as SendCounts;
      assertSendWithinLimits(counts);

      const counterExpiresAt = Timestamp.fromMillis(now + LIMIT_COUNTER_TTL_MS);
      for (const [, limitRef] of limitRefs) {
        transaction.set(limitRef, { count: FieldValue.increment(1), expiresAt: counterExpiresAt }, { merge: true });
      }
      // Overwrites any earlier code: only the newest one works
      transaction.set(ref, {
        codeHash,
        salt,
        attempts: 0,
        expiresAt: Timestamp.fromMillis(now + CODE_TTL_MS),
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    try {
      await deliverCode(email, code);
    } catch (error) {
      logger.error("sendSignInCode delivery failed", error instanceof Error ? error.message : error);
      await ref.delete();
      throw new HttpsError("internal", "We couldn't send the email. Try again, or sign in with Google.");
    }

    return { sent: true };
  },
);

async function findOrCreateUser(email: string): Promise<{ user: UserRecord; isNewUser: boolean }> {
  const auth = getAuth();
  try {
    return { user: await auth.getUserByEmail(email), isNewUser: false };
  } catch (error) {
    if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
  }
  try {
    return { user: await auth.createUser({ email, emailVerified: true }), isNewUser: true };
  } catch (error) {
    // Signed up another way (Google) between the lookup and the create
    if ((error as { code?: string }).code !== "auth/email-already-exists") throw error;
    return { user: await auth.getUserByEmail(email), isNewUser: false };
  }
}

/**
 * Checks an emailed code and returns a custom token for the account with
 * that email (created if new). Any account, password or Google, signs in to
 * its own uid, since the code proves the person controls the email.
 */
export const verifySignInCode = onCall(
  { maxInstances: 5, concurrency: 40, cpu: 1, memory: "256MiB", timeoutSeconds: 30 },
  async (request) => {
    const email = normalizeEmail(request.data?.email);
    const code = normalizeCode(request.data?.code);
    const ref = codeRef(email);

    // Returns instead of throwing inside the transaction: a throw would roll
    // back the attempt counter
    const valid = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const stored = snapshot.data() as StoredCode | undefined;
      if (!stored) return false;

      if (stored.expiresAt.toMillis() <= Date.now() || stored.attempts >= MAX_ATTEMPTS) {
        transaction.delete(ref);
        return false;
      }

      if (!codeMatches(code, stored.salt, stored.codeHash)) {
        if (stored.attempts + 1 >= MAX_ATTEMPTS) {
          transaction.delete(ref);
        } else {
          transaction.update(ref, { attempts: FieldValue.increment(1) });
        }
        return false;
      }

      transaction.delete(ref);
      return true;
    });

    if (!valid) {
      throw new HttpsError("invalid-argument", INVALID_CODE_MESSAGE);
    }

    try {
      const { user, isNewUser } = await findOrCreateUser(email);
      if (user.disabled) {
        throw new HttpsError("permission-denied", "This account is disabled.");
      }
      if (!user.emailVerified) {
        await getAuth().updateUser(user.uid, { emailVerified: true });
      }
      const token = await getAuth().createCustomToken(user.uid);
      return { token, isNewUser };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("verifySignInCode sign-in failed", error instanceof Error ? error.message : error);
      throw new HttpsError("internal", "We couldn't sign you in. Request a new code, or sign in with Google.");
    }
  },
);
