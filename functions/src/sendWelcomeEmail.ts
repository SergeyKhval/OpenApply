import { Resend } from "resend";
import { user } from "firebase-functions/v1/auth";
import { getFirestore } from "firebase-admin/firestore";
import { defineString } from "firebase-functions/params";

const RESEND_API_KEY = defineString("RESEND_API_KEY");
const db = getFirestore();

export const sendWelcomEmail = user().onCreate(async (user) => {
  if (!RESEND_API_KEY.value()) {
    console.warn("RESEND_API_KEY is not set. Skipping welcome email.");
    return;
  }
  if (!user.email) return;

  const resend = new Resend(RESEND_API_KEY.value());
  const welcomeEmailRef = db.collection("emailTemplates").doc("welcomeEmail");
  const welcomeEmailDoc = await welcomeEmailRef.get();
  const templateData = welcomeEmailDoc.exists && welcomeEmailDoc.data();

  if (templateData) {
    const { subject, html, from, replyTo } = templateData;

    try {
      await resend.emails.send({
        to: user.email,
        from,
        replyTo,
        subject,
        html,
      });
    } catch (error) {
      console.error("Error sending welcome email:", error);
    }
  }
});
