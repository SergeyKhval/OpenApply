<template>
  <li class="border-l-3 border-sidebar-border pl-4 py-1 flex flex-col">
    <template v-if="viewMode === 'view'">
      <div class="flex items-center gap-2 text-xs text-gray-400">
        <PhNote />
        <time :datetime="note.createdAt.toDate().toLocaleDateString()">{{
          note.createdAt.toDate().toLocaleString()
        }}</time>
        <template v-if="note.updatedAt">(edited)</template>
      </div>

      <p class="text-foreground mb-3">{{ note.text }}</p>

      <div class="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          title="Edit"
          @click="viewMode = 'edit'"
        >
          <PhPencil />
        </Button>
        <Button
          size="sm"
          variant="secondary"
          title="Delete"
          @click="deleteNote()"
        >
          <PhTrash />
        </Button>
      </div>
    </template>

    <form v-else class="flex flex-col gap-2" @submit.prevent="updateNote()">
      <Textarea
        v-model="updatedNote"
        placeholder="ah... whatever"
        @keydown.ctrl.enter="updateNote()"
      />

      <div class="flex items-center gap-2">
        <Button size="sm" type="submit" title="Save">
          <PhCheckFat />
          Save
        </Button>
        <Button
          size="sm"
          variant="secondary"
          title="Cancel"
          @click="exitViewMode()"
        >
          <PhRewind />
          Cancel
        </Button>
      </div>
    </form>
  </li>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  PhCheckFat,
  PhNote,
  PhPencil,
  PhRewind,
  PhTrash,
} from "@phosphor-icons/vue";
import { JobApplicationNote } from "@/types";
import { deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/firebase/config.ts";
import { ref } from "vue";
import { Textarea } from "@/components/ui/textarea";
import { onKeyStroke } from "@vueuse/core";

type JobApplicationNoteProps = {
  note: JobApplicationNote;
};

const { note } = defineProps<JobApplicationNoteProps>();

const viewMode = ref<"view" | "edit">("view");
const updatedNote = ref(note.text);

async function updateNote() {
  const text = updatedNote.value.trim();
  if (!text) return;

  await updateDoc(doc(db, "jobApplicationNotes", note.id), {
    text,
    updatedAt: serverTimestamp(),
  });

  viewMode.value = "view";
}

async function deleteNote() {
  const ok = confirm(
    "Are you sure you want to delete this note? This action is irreversible",
  );
  if (ok) await deleteDoc(doc(db, "jobApplicationNotes", note.id));
}

function exitViewMode() {
  if (viewMode.value === "edit") {
    viewMode.value = "view";
    updatedNote.value = note.text;
  }
}

onKeyStroke("Escape", exitViewMode);
</script>
