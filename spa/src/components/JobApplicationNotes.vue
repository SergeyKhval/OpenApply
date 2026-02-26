<template>
  <Card>
    <CardHeader>
      <CardTitle>Notes</CardTitle>
    </CardHeader>
    <CardContent class="mb-6">
      <ul v-if="notes.length" class="flex flex-col gap-6">
        <JobApplicationNote v-for="note in notes" :key="note.id" :note="note" />
      </ul>
      <p
        v-else
        class="text-muted-foreground flex flex-col items-center gap-2 text-center"
      >
        <PhNoteBlank size="64" />
        It feels a little empty here... Maybe add a note?
      </p>
    </CardContent>
    <CardFooter>
      <form
        class="grow flex flex-col items-end gap-2"
        @submit.prevent="addNote()"
      >
        <Textarea
          v-model="newNoteText"
          placeholder="Recruiter was a real pain...
Ctrl+Enter to save"
          @keydown.ctrl.enter="addNote()"
        />
        <Button type="submit" size="sm" variant="outline">
          <PhNotePencil />
          Add note
        </Button>
      </form>
    </CardFooter>
  </Card>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { PhNoteBlank, PhNotePencil } from "@phosphor-icons/vue";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCollection, useCurrentUser } from "vuefire";
import {
  addDoc,
  collection,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "@/firebase/config.ts";
import { type JobApplicationNote as JobApplicationNoteType } from "@/types";
import JobApplicationNote from "@/components/JobApplicationNote.vue";
import { trackEvent } from "@/analytics";

type JobApplicationNotesProps = {
  applicationId: string;
};

const { applicationId } = defineProps<JobApplicationNotesProps>();

const user = useCurrentUser();

const { data: notes } = useCollection<JobApplicationNoteType>(
  query(
    collection(db, "jobApplicationNotes"),
    where("userId", "==", user.value?.uid || ""),
    where("jobApplicationId", "==", applicationId),
    orderBy("createdAt", "desc"),
  ),
);

const newNoteText = ref("");

async function addNote() {
  const text = newNoteText.value.trim();

  if (!user.value || !applicationId || !text) return;

  await addDoc(collection(db, "jobApplicationNotes"), {
    text,
    userId: user.value.uid,
    jobApplicationId: applicationId,
    createdAt: serverTimestamp(),
  });

  trackEvent("note_created", { applicationId });
  newNoteText.value = "";
}
</script>
