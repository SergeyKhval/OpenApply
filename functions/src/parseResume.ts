import { onObjectFinalized } from "firebase-functions/v2/storage";
import { getStorage } from "firebase-admin/storage";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { PDFParse } from "pdf-parse";

export const parseResume = onObjectFinalized(async (object) => {
  const filePath = object.data.name;
  if (!filePath.startsWith("resumes/")) return;

  const bucket = getStorage().bucket(object.bucket);
  const file = bucket.file(filePath);
  const snapshot = await getFirestore()
    .collection("userResumes")
    .where("storagePath", "==", filePath)
    .get();

  try {
    const [buffer] = await file.download();
    const parser = new PDFParse({ data: buffer });
    const { text } = await parser.getText();
    await parser.destroy();

    for (const doc of snapshot.docs) {
      await doc.ref.update({
        status: "parsed",
        text,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  } catch (e) {
    console.error("Error parsing resume:", e);
    for (const doc of snapshot.docs) {
      await doc.ref.update({
        status: "parse-failed",
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }
});
