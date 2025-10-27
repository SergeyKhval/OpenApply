import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onCall } from "firebase-functions/v2/https";

const db = getFirestore();

export const migrateCoverLettersToJobApplications = onCall(async () => {
  try {
    // Fetch all cover letters
    const coverLettersSnapshot = await db.collection("coverLetters").get();

    console.log(`Found ${coverLettersSnapshot.size} cover letters to process`);

    let processedCount = 0;
    let errorCount = 0;

    // Process each cover letter
    for (const coverLetterDoc of coverLettersSnapshot.docs) {
      try {
        const coverLetterData = coverLetterDoc.data();
        const jobApplicationId = coverLetterData.jobApplicationId;

        // Skip if no jobApplicationId (already migrated or never had one)
        if (!jobApplicationId) {
          continue;
        }

        // Fetch the corresponding job application
        const jobApplicationDoc = await db
          .collection("jobApplications")
          .doc(jobApplicationId)
          .get();

        let jobApplicationData;

        if (jobApplicationDoc.exists) {
          const jobApp = jobApplicationDoc.data();
          jobApplicationData = {
            id: jobApplicationId,
            companyName: jobApp?.companyName || "",
            companyLogoUrl: jobApp?.companyLogoUrl || null,
            position: jobApp?.position || "",
          };
        } else {
          // Job application doesn't exist, set to null/empty
          console.warn(
            `Job application ${jobApplicationId} not found for cover letter ${coverLetterDoc.id}`
          );
          jobApplicationData = {
            id: jobApplicationId,
            companyName: "",
            companyLogoUrl: null,
            position: "",
          };
        }

        // Update the cover letter with the new structure
        await coverLetterDoc.ref.update({
          jobApplication: jobApplicationData,
          jobApplicationId: FieldValue.delete(), // Remove the old field
        });

        processedCount++;

        if (processedCount % 10 === 0) {
          console.log(`Processed ${processedCount} cover letters...`);
        }
      } catch (error) {
        errorCount++;
        console.error(
          `Error processing cover letter ${coverLetterDoc.id}:`,
          error
        );
      }
    }

    console.log(
      `Migration completed. Processed: ${processedCount}, Errors: ${errorCount}`
    );

    return {
      success: true,
      message: `Successfully migrated ${processedCount} cover letters`,
    };
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
});
