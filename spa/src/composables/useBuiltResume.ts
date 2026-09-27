import { computed, onBeforeUnmount, ref, watch, type Ref } from "vue";
import { useCurrentUser, useDocument } from "vuefire";
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { trackEvent } from "@/analytics";
import { emptyStructuredResume, isResumeComplete, serializeResume, type StructuredResume } from "@/lib/builtResume";
import { newId, newSection } from "@/lib/builtResumeEdit";
import type { BuiltResume } from "@/types";

export const AUTOSAVE_DELAY_MS = 1000;

export type SaveState = "idle" | "saving" | "saved" | "error";

type Snapshot = { structured: StructuredResume; title: string };

const snapshotOf = (structured: StructuredResume, title: string): string => JSON.stringify({ structured, title });

/**
 * A new built resume from scratch: contact prefilled from the account, the
 * usual sections empty. Returns the new doc's id.
 */
export async function createBuiltResume(userId: string, contact: { name?: string | null; email?: string | null }): Promise<string> {
  const structured = emptyStructuredResume({ name: contact.name ?? "", email: contact.email ?? "" }, newId);
  // Open on an empty job and school to fill in, not an "Add" button
  structured.sections = structured.sections.map((section) =>
    section.type === "experience" || section.type === "education" ? newSection(section.type, section.id) : section,
  );
  const ref = await addDoc(collection(db, "userResumes"), {
    userId,
    kind: "built",
    status: "parsed",
    title: "Resume",
    template: "classic",
    structured,
    text: serializeResume(structured),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  trackEvent("resume_builder_started", { source: "scratch" });
  return ref.id;
}

/**
 * The editor's state for one built resume: a local draft that saves itself
 * a second after the last change (and right away on leave), with the text
 * every AI feature reads derived from it on each save.
 */
export function useBuiltResume(resumeId: Ref<string>) {
  const user = useCurrentUser();
  const resumeRef = computed(() => (user.value ? doc(db, "userResumes", resumeId.value) : null));
  const { data: resume, pending, error: loadError } = useDocument<BuiltResume>(resumeRef);

  const draft = ref<StructuredResume | null>(null);
  const title = ref("");
  const saveState = ref<SaveState>("idle");
  let lastSaved = "";
  let completedSent = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  // Load once: later snapshots are our own writes coming back
  watch(
    resume,
    (value) => {
      if (draft.value || !value || value.kind !== "built") return;
      // A plain copy: structuredClone throws on Vue's reactive proxies
      const loaded: StructuredResume = JSON.parse(JSON.stringify(value.structured));
      draft.value = loaded;
      title.value = value.title;
      lastSaved = snapshotOf(loaded, title.value);
      completedSent = !!value.completedAt;
    },
    { immediate: true },
  );

  async function save(): Promise<void> {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!draft.value || !resumeRef.value) return;
    const snapshot: Snapshot = JSON.parse(snapshotOf(draft.value, title.value));
    const serialized = snapshotOf(snapshot.structured, snapshot.title);
    if (serialized === lastSaved) return;

    const completing = !completedSent && isResumeComplete(snapshot.structured);
    saveState.value = "saving";
    try {
      await updateDoc(resumeRef.value, {
        structured: snapshot.structured,
        text: serializeResume(snapshot.structured),
        title: snapshot.title.trim().slice(0, 120) || "Resume",
        updatedAt: serverTimestamp(),
        ...(completing ? { completedAt: serverTimestamp() } : {}),
      });
      lastSaved = serialized;
      saveState.value = "saved";
      if (completing) {
        completedSent = true;
        trackCompleted(snapshot.structured);
      }
    } catch (error) {
      console.error("Saving the resume failed:", error);
      saveState.value = "error";
    }
  }

  function trackCompleted(structured: StructuredResume) {
    const entrySections = structured.sections.filter((section) => "entries" in section);
    const created = resume.value?.createdAt?.toDate?.();
    trackEvent("resume_builder_completed", {
      source: resume.value?.importedFrom?.source ?? "scratch",
      sections: structured.sections.length,
      entries: entrySections.reduce((sum, section) => sum + ("entries" in section ? section.entries.length : 0), 0),
      bullets: entrySections.reduce(
        (sum, section) => sum + ("entries" in section ? section.entries.reduce((count, entry) => count + entry.bullets.length, 0) : 0),
        0,
      ),
      minutesSinceStart: created ? Math.round((Date.now() - created.getTime()) / 60000) : 0,
    });
  }

  watch(
    [draft, title],
    () => {
      if (!draft.value || snapshotOf(draft.value, title.value) === lastSaved) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(save, AUTOSAVE_DELAY_MS);
    },
    { deep: true },
  );

  const flush = () => (timer ? save() : Promise.resolve());
  onBeforeUnmount(() => {
    void flush();
  });

  return { resume, draft, title, pending, loadError, saveState, save, flush };
}
