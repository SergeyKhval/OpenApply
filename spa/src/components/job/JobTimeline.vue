<!-- Everything that happened with this job, in one list: notes, interviews,
     contacts and stage changes. Replaces the separate Interviews, Notes and
     Contacts cards. -->
<template>
  <Card class="gap-4">
    <CardHeader class="flex items-center justify-between">
      <CardTitle class="text-lg">Timeline</CardTitle>
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Add to the timeline" class="flex w-fit gap-0.5 rounded-full bg-muted p-1">
        <button
          v-for="kind in COMPOSER_KINDS"
          :key="kind.value"
          type="button"
          role="radio"
          :aria-checked="composer === kind.value"
          class="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm"
          :class="composer === kind.value ? 'bg-card font-semibold text-foreground shadow-card' : 'text-soft-foreground'"
          @click="composer = kind.value; editing = null"
        >
          <component :is="kind.icon" :size="16" />
          {{ kind.label }}
        </button>
      </div>

      <form v-if="composer === 'note'" class="flex flex-col gap-2" @submit.prevent="submitNote">
        <Label for="timeline-note" class="sr-only">Note</Label>
        <Textarea
          id="timeline-note"
          v-model="noteText"
          rows="2"
          placeholder="Add a note: what the recruiter said, questions to ask…"
          @keydown.meta.enter="submitNote"
          @keydown.ctrl.enter="submitNote"
        />
        <Button type="submit" size="sm" class="self-end" :disabled="!noteText.trim()">Add note</Button>
      </form>
      <InterviewForm
        v-else-if="composer === 'interview'"
        :interview="{ name: '' }"
        @save="(form) => saveInterview(form).then(() => (composer = 'note'))"
        @cancel="composer = 'note'"
      />
      <ContactForm
        v-else
        :contact="EMPTY_CONTACT"
        @save="(form) => saveContact(form).then(() => (composer = 'note'))"
        @cancel="composer = 'note'"
      />

      <ol class="flex flex-col">
        <li v-for="(entry, index) in entries" :key="entry.id" class="relative flex gap-3.5 pb-4">
          <span
            v-if="index < entries.length - 1"
            class="absolute top-10 bottom-0 left-[17px] w-0.5 bg-border"
            aria-hidden="true"
          />
          <span
            class="grid size-9 shrink-0 place-items-center rounded-full"
            :class="entry.upcoming ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-soft-foreground'"
          >
            <component :is="ICONS[entry.kind]" :size="18" />
          </span>

          <div class="flex min-w-0 grow flex-col gap-0.5 pt-0.5">
            <div class="flex items-start justify-between gap-2">
              <span class="text-[13px] text-muted-foreground">
                <b class="font-bold text-foreground">{{ KIND_LABELS[entry.kind] }}</b>
                · {{ formatDate(entry) }}<template v-if="entry.upcoming"> · upcoming</template>
                <template v-if="entry.kind === 'interview' && entry.interview.status !== 'pending'">
                  · {{ entry.interview.status === "passed" ? "passed" : "didn't pass" }}
                </template>
              </span>
              <DropdownMenu v-if="entry.kind !== 'stage'">
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon-sm" class="-mt-1.5 -mr-2" :aria-label="`Options for ${KIND_LABELS[entry.kind].toLowerCase()}`">
                    <PhDotsThree :size="18" weight="bold" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <template v-if="entry.kind === 'interview'">
                    <DropdownMenuItem @select="setInterviewStatus(entry.id, 'passed')">Mark passed</DropdownMenuItem>
                    <DropdownMenuItem @select="setInterviewStatus(entry.id, 'failed')">Mark didn't pass</DropdownMenuItem>
                  </template>
                  <DropdownMenuItem @select="startEdit(entry)"><PhPencilSimple />Edit</DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" @select="confirmRemove(entry)"><PhTrash />Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <template v-if="editing === entry.id">
              <form v-if="entry.kind === 'note'" class="flex flex-col gap-2" @submit.prevent="saveNoteEdit(entry.id)">
                <Label :for="`edit-${entry.id}`" class="sr-only">Note</Label>
                <Textarea :id="`edit-${entry.id}`" v-model="editText" rows="3" />
                <div class="flex gap-2 self-end">
                  <Button type="button" variant="ghost" size="sm" @click="editing = null">Cancel</Button>
                  <Button type="submit" size="sm">Save</Button>
                </div>
              </form>
              <InterviewForm
                v-else-if="entry.kind === 'interview'"
                :interview="entry.interview"
                @save="(form) => saveInterview(form, entry.id).then(() => (editing = null))"
                @cancel="editing = null"
              />
              <ContactForm
                v-else-if="entry.kind === 'contact'"
                :contact="entry.contact"
                @save="(form) => saveContact(form, entry.id).then(() => (editing = null))"
                @cancel="editing = null"
              />
            </template>
            <template v-else>
              <p v-if="entry.kind === 'note'" class="text-[15px] leading-relaxed whitespace-pre-line">{{ entry.note.text }}</p>
              <p v-else-if="entry.kind === 'contact'" class="text-[15px]">
                {{ entry.title }}<span v-if="entry.contact.position" class="text-soft-foreground">, {{ entry.contact.position }}</span>
                <span class="flex flex-wrap gap-x-3 text-sm">
                  <a v-if="entry.contact.email" :href="`mailto:${entry.contact.email}`" class="text-secondary-foreground hover:underline">{{ entry.contact.email }}</a>
                  <a v-if="entry.contact.linkedInUrl" :href="entry.contact.linkedInUrl" target="_blank" rel="noopener noreferrer nofollow" class="text-secondary-foreground hover:underline">LinkedIn</a>
                </span>
              </p>
              <p v-else class="text-[15px]">{{ entry.title }}</p>
            </template>
          </div>
        </li>
      </ol>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { ref, type Component } from "vue";
import {
  PhArrowRight,
  PhCalendarBlank,
  PhDotsThree,
  PhNotePencil,
  PhPencilSimple,
  PhTrash,
  PhUser,
} from "@phosphor-icons/vue";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ContactForm from "@/components/ContactForm.vue";
import InterviewForm from "@/components/InterviewForm.vue";
import type { TimelineEntry } from "@/lib/timeline";
import type { ContactFormContact, Interview, InterviewFormInterview } from "@/types";

type Kind = TimelineEntry["kind"];

const { entries, addNote, updateNote, saveInterview, setInterviewStatus, saveContact, remove } = defineProps<{
  entries: TimelineEntry[];
  addNote: (text: string) => Promise<void>;
  updateNote: (noteId: string, text: string) => Promise<void>;
  saveInterview: (form: InterviewFormInterview, interviewId?: string) => Promise<unknown>;
  setInterviewStatus: (interviewId: string, status: Interview["status"]) => Promise<void>;
  saveContact: (form: ContactFormContact, contactId?: string) => Promise<unknown>;
  remove: (kind: "note" | "interview" | "contact", id: string) => Promise<void>;
}>();

const COMPOSER_KINDS: { value: "note" | "interview" | "contact"; label: string; icon: Component }[] = [
  { value: "note", label: "Note", icon: PhNotePencil },
  { value: "interview", label: "Interview", icon: PhCalendarBlank },
  { value: "contact", label: "Contact", icon: PhUser },
];
const ICONS: Record<Kind, Component> = {
  note: PhNotePencil,
  interview: PhCalendarBlank,
  contact: PhUser,
  stage: PhArrowRight,
};
const KIND_LABELS: Record<Kind, string> = { note: "Note", interview: "Interview", contact: "Contact", stage: "Stage" };
const EMPTY_CONTACT: ContactFormContact = { firstName: "", lastName: "", position: "", email: "", linkedInUrl: "" };

const composer = ref<"note" | "interview" | "contact">("note");
const noteText = ref("");
const editing = ref<string | null>(null);
const editText = ref("");

const formatDate = (entry: TimelineEntry) =>
  entry.kind === "interview"
    ? entry.date.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : entry.date.toLocaleDateString(undefined, { day: "numeric", month: "short" });

async function submitNote() {
  const text = noteText.value;
  if (!text.trim()) return;
  noteText.value = "";
  await addNote(text);
}

function startEdit(entry: TimelineEntry) {
  editing.value = entry.id;
  if (entry.kind === "note") editText.value = entry.note.text;
}

async function saveNoteEdit(noteId: string) {
  if (!editText.value.trim()) return;
  await updateNote(noteId, editText.value);
  editing.value = null;
}

function confirmRemove(entry: TimelineEntry) {
  if (entry.kind === "stage") return;
  const ok = confirm(`Delete this ${KIND_LABELS[entry.kind].toLowerCase()}? This can't be undone.`);
  if (ok) remove(entry.kind, entry.id);
}
</script>
