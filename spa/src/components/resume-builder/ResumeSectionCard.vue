<template>
  <section class="rounded-card bg-card shadow-card dark:border dark:border-border" :aria-labelledby="`${section.id}-heading`">
    <header class="flex items-center gap-2 border-b border-border py-2 pr-2 pl-4">
      <button
        :id="`${section.id}-heading`"
        type="button"
        class="flex min-w-0 grow items-center gap-2 py-2 text-left font-bold"
        :aria-expanded="open"
        @click="open = !open"
      >
        <PhCaretRight :size="16" class="shrink-0 transition-transform" :class="open && 'rotate-90'" />
        <span class="truncate">{{ section.heading }}</span>
        <span v-if="countLabel" class="shrink-0 text-sm font-normal text-muted-foreground">{{ countLabel }}</span>
      </button>
      <ReorderButtons :label="section.heading" :index="index" :count="count" @move="emit('move', $event)" @remove="emit('remove')" />
    </header>

    <div v-show="open" class="flex flex-col gap-4 p-4">
      <div v-if="headingOptions.length > 1" class="flex flex-col gap-1.5">
        <Label :for="`${section.id}-heading-select`">Heading on the page</Label>
        <select
          :id="`${section.id}-heading-select`"
          v-model="section.heading"
          class="h-11 rounded-field border border-input bg-card px-3 text-[15px] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 md:text-sm"
        >
          <option v-for="option in headingOptions" :key="option" :value="option">{{ option }}</option>
        </select>
      </div>

      <Textarea
        v-if="section.type === 'summary'"
        v-model="section.text"
        :aria-label="section.heading"
        placeholder="Two or three sentences on what you do and what you're looking for."
      />

      <ResumeItemsEditor
        v-else-if="'items' in section"
        v-model="section.items"
        :label="section.heading"
        :as-tags="section.type === 'skills' || section.type === 'languages'"
        :placeholder="ITEM_PLACEHOLDERS[section.type]"
      />
      <FlaggedHint v-if="'items' in section" :path="`sections.${section.id}.items`" :value="section.items" />

      <template v-else-if="'entries' in section">
        <article
          v-for="(entry, entryIndex) in section.entries"
          :key="entry.id"
          class="flex flex-col gap-3 rounded-field border border-border p-3"
          :aria-label="entryLabel(entryIndex)"
        >
          <div class="flex items-center gap-2">
            <h3 class="min-w-0 grow truncate text-sm font-semibold">{{ entryLabel(entryIndex) }}</h3>
            <ReorderButtons
              :label="entryLabel(entryIndex)"
              :index="entryIndex"
              :count="section.entries.length"
              @move="moveInPlace(section.entries as unknown[], entryIndex, $event)"
              @remove="emit('removeEntry', entryIndex)"
            />
          </div>
          <ResumeEntryForm v-model="section.entries[entryIndex]!" :section-type="section.type" :path="`sections.${section.id}.entries.${entry.id}`" />
        </article>
        <Button variant="secondary" class="self-start" @click="addEntry">
          <PhPlus :size="18" />
          {{ ADD_ENTRY[section.type] }}
        </Button>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { PhCaretRight, PhPlus } from "@phosphor-icons/vue";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import FlaggedHint from "@/components/resume-builder/FlaggedHint.vue";
import ReorderButtons from "@/components/resume-builder/ReorderButtons.vue";
import ResumeEntryForm from "@/components/resume-builder/ResumeEntryForm.vue";
import ResumeItemsEditor from "@/components/resume-builder/ResumeItemsEditor.vue";
import { SECTION_HEADINGS, type ItemSectionType, type ResumeEducation, type ResumeRole, type ResumeSection, type RoleSectionType } from "@/lib/builtResume";
import { moveInPlace, newEducation, newRole } from "@/lib/builtResumeEdit";

type ResumeSectionCardProps = { index: number; count: number };

const { index, count } = defineProps<ResumeSectionCardProps>();
const section = defineModel<ResumeSection>({ required: true });
const emit = defineEmits<{
  (event: "move", delta: -1 | 1): void;
  (event: "remove"): void;
  (event: "removeEntry", entryIndex: number): void;
}>();

const open = ref(true);

const ITEM_PLACEHOLDERS: Record<ItemSectionType, string> = {
  skills: "Type a skill, then Enter",
  languages: "Polish (native), then Enter",
  certifications: "AWS Certified Developer, 2022",
  awards: "Dean's list, 2019",
};

const ADD_ENTRY: Record<RoleSectionType | "education", string> = {
  experience: "Add a job",
  projects: "Add a project",
  volunteering: "Add a role",
  education: "Add a school",
};

const headingOptions = computed(() => SECTION_HEADINGS[section.value.type]);

const countLabel = computed(() => {
  const value = section.value;
  if ("entries" in value) return value.entries.length ? String(value.entries.length) : "";
  if ("items" in value) return value.items.length ? String(value.items.length) : "";
  return "";
});

function entryLabel(entryIndex: number): string {
  const value = section.value;
  if (!("entries" in value)) return "";
  const entry = value.entries[entryIndex];
  if (!entry) return "";
  const name =
    value.type === "education"
      ? [(entry as ResumeEducation).degree, (entry as ResumeEducation).school]
      : [(entry as ResumeRole).title, (entry as ResumeRole).organization];
  return name.filter((part) => part.trim()).join(", ") || `${ADD_ENTRY[value.type].replace("Add a", "New")}`;
}

function addEntry() {
  const value = section.value;
  if (value.type === "education") value.entries.push(newEducation());
  else if ("entries" in value) value.entries.push(newRole());
}
</script>
