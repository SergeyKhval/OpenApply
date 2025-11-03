import { onObjectFinalized } from "firebase-functions/v2/storage";
import { getStorage } from "firebase-admin/storage";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { PDFParse } from "pdf-parse";

const db = getFirestore();

export const parseResume = onObjectFinalized(async (object) => {
  const filePath = object.data.name;

  if (!filePath.startsWith("resumes/")) {
    console.log("File is not in resumes/ directory, skipping parse.");
    return;
  }

  const [, userId, fileName] = filePath.split("/");
  const file = getStorage().bucket().file(object.data.name);

  try {
    const [buffer] = await file.download();
    const parser = new PDFParse({ data: buffer });
    const { text } = await parser.getText();
    await parser.destroy();

    await db.collection("userResumes").add({
      userId,
      // filename comes in format: <timestamp>-<originalFileName>
      fileName: fileName.split("-").slice(1).join("-"),
      fileSize: object.data.size,
      text,
      status: "parsed",
      storagePath: object.data.name,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error("Error parsing resume:", e);
  }
});
