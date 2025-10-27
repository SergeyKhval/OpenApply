import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const db = getFirestore();

export const importJobApplications = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  const { applications } = request.data;

  if (!applications || !Array.isArray(applications)) {
    throw new HttpsError("invalid-argument", "applications must be an array");
  }

  try {
    await Promise.all(
      applications.map(
        (application: { companyName: string; position: string }) => {
          if (!application.companyName || !application.position) {
            return Promise.resolve(null);
          }
          return db.collection("jobApplications").add({
            ...application,
            userId: request.auth?.uid,
            status: "applied",
            appliedAt: FieldValue.serverTimestamp(),
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        },
      ),
    );

    return {
      success: true,
      total: applications.length,
    };
  } catch (error) {
    console.error("Error importing job applications:", error);
    throw new HttpsError("internal", "Failed to import job applications");
  }
});
