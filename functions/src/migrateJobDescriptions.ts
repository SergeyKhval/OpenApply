import { onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

const db = getFirestore();

export const migrateJobDescriptions = onCall(async () => {
  const jobApplicationsRef = db.collection("jobApplications");
  const snapshot = await jobApplicationsRef.get();

  let updated = 0;
  let skipped = 0;
  const errors: { id: string; error: string }[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const jobDescription = data.jobDescription;
    const jobId = data.jobId;

    if (jobDescription && jobDescription.trim() !== "") {
      skipped++;
      continue;
    }
    if (!jobId) {
      errors.push({ id: doc.id, error: "Missing jobId" });
      continue;
    }
    try {
      const jobDoc = await db.collection("jobs").doc(jobId).get();
      if (!jobDoc.exists) {
        errors.push({ id: doc.id, error: "Job not found" });
        continue;
      }
      const jobData = jobDoc.data();
      // Try to get job description from parsedData.description or fallback to jobData.description
      const newJobDescription =
        jobData?.parsedData?.description || jobData?.description || "";
      if (!newJobDescription || newJobDescription.trim() === "") {
        errors.push({ id: doc.id, error: "No job description in job" });
        continue;
      }
      await doc.ref.update({ jobDescription: newJobDescription });
      updated++;
    } catch (err: any) {
      errors.push({ id: doc.id, error: err.message || String(err) });
    }
  }

  return {
    updated,
    skipped,
    errors,
    total: snapshot.size,
  };
});
