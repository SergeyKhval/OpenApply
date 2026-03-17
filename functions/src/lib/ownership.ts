import { HttpsError } from "firebase-functions/v2/https";

/**
 * Validates that the document belongs to the given user.
 * Throws permission-denied if not.
 */
export function validateResourceOwnership(
  doc: { userId: string },
  userId: string,
): void {
  if (!doc.userId || doc.userId !== userId) {
    throw new HttpsError(
      "permission-denied",
      "User does not have access to this resource",
    );
  }
}
