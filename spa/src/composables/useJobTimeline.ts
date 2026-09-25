import { computed, type Ref } from "vue";
import { useCollection, useCurrentUser } from "vuefire";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { trackEvent } from "@/analytics";
import { buildTimeline } from "@/lib/timeline";
import type {
  Contact,
  ContactFormContact,
  Interview,
  InterviewFormInterview,
  JobApplication,
  JobApplicationNote,
} from "@/types";

// Notes, interviews and contacts of one job, merged into one timeline, plus
// the writes the timeline's composer and entry menus need. Same queries (and
// indexes) as the old separate cards.
export function useJobTimeline(job: Ref<JobApplication | null | undefined>, jobId: string) {
  const user = useCurrentUser();

  // Sort directions must match the composite indexes in firestore.indexes.json
  const byUser = <T>(name: string, jobField: string, orderField: string, direction: "asc" | "desc") =>
    useCollection<T>(
      computed(() =>
        user.value
          ? query(
              collection(db, name),
              where("userId", "==", user.value.uid),
              where(jobField, "==", jobId),
              orderBy(orderField, direction),
            )
          : null,
      ),
    );

  const { data: notes } = byUser<JobApplicationNote>("jobApplicationNotes", "jobApplicationId", "createdAt", "desc");
  const { data: interviews } = byUser<Interview>("interviews", "applicationId", "conductedAt", "asc");
  const { data: contacts } = byUser<Contact>("contacts", "jobApplicationId", "createdAt", "asc");

  const entries = computed(() =>
    job.value
      ? buildTimeline(
          { job: job.value, notes: notes.value ?? [], interviews: interviews.value ?? [], contacts: contacts.value ?? [] },
          new Date(),
        )
      : [],
  );

  const owner = () => user.value?.uid;

  async function addNote(text: string) {
    const trimmed = text.trim();
    if (!owner() || !trimmed) return;
    await addDoc(collection(db, "jobApplicationNotes"), {
      text: trimmed,
      userId: owner(),
      jobApplicationId: jobId,
      createdAt: serverTimestamp(),
    });
    trackEvent("note_created", { applicationId: jobId });
  }

  const updateNote = (noteId: string, text: string) =>
    updateDoc(doc(db, "jobApplicationNotes", noteId), { text: text.trim(), updatedAt: serverTimestamp() });

  async function saveInterview(form: InterviewFormInterview, interviewId?: string) {
    if (!owner()) return;
    const fields = { name: form.name, conductedAt: form.conductedAt.toDate() };
    if (interviewId) return updateDoc(doc(db, "interviews", interviewId), fields);
    await addDoc(collection(db, "interviews"), {
      ...fields,
      status: "pending",
      createdAt: serverTimestamp(),
      userId: owner(),
      applicationId: jobId,
    });
    trackEvent("interview_created", { applicationId: jobId });
  }

  const setInterviewStatus = (interviewId: string, status: Interview["status"]) =>
    updateDoc(doc(db, "interviews", interviewId), { status });

  async function saveContact(form: ContactFormContact, contactId?: string) {
    if (!owner()) return;
    if (contactId) return updateDoc(doc(db, "contacts", contactId), { ...form, updatedAt: serverTimestamp() });
    await addDoc(collection(db, "contacts"), {
      ...form,
      createdAt: serverTimestamp(),
      userId: owner(),
      jobApplicationId: jobId,
    });
    trackEvent("contact_created", { applicationId: jobId });
  }

  const COLLECTIONS = { note: "jobApplicationNotes", interview: "interviews", contact: "contacts" } as const;
  const remove = (kind: keyof typeof COLLECTIONS, id: string) => deleteDoc(doc(db, COLLECTIONS[kind], id));

  return { entries, contacts, addNote, updateNote, saveInterview, setInterviewStatus, saveContact, remove };
}
