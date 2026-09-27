<template>
  <div class="flex flex-col gap-3">
    <div class="grid gap-3 sm:grid-cols-2">
      <div class="flex flex-col gap-1.5">
        <Label :for="`${entry.id}-title`">{{ isEducation ? "Degree" : titleLabel }}</Label>
        <Input
          v-if="isEducation"
          :id="`${entry.id}-title`"
          v-model="(entry as ResumeEducation).degree"
          placeholder="BSc Computer Science"
        />
        <Input v-else :id="`${entry.id}-title`" v-model="(entry as ResumeRole).title" :placeholder="titlePlaceholder" />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label :for="`${entry.id}-organization`">{{ isEducation ? "School" : organizationLabel }}</Label>
        <Input
          v-if="isEducation"
          :id="`${entry.id}-organization`"
          v-model="(entry as ResumeEducation).school"
          placeholder="Warsaw University of Technology"
        />
        <Input v-else :id="`${entry.id}-organization`" v-model="(entry as ResumeRole).organization" :placeholder="organizationPlaceholder" />
      </div>
      <div class="flex flex-col gap-1.5 sm:col-span-2">
        <Label :for="`${entry.id}-location`">Location <span class="font-normal text-muted-foreground">(optional)</span></Label>
        <Input :id="`${entry.id}-location`" v-model="entry.location" placeholder="City, or Remote" />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label :for="`${entry.id}-start`">Start</Label>
        <YearMonthInput :id="`${entry.id}-start`" v-model="entry.start" label="Start" />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label :for="`${entry.id}-end`">End</Label>
        <YearMonthInput :id="`${entry.id}-end`" v-model="endDate" label="End" :disabled="isPresent" />
        <label v-if="!isEducation" class="flex items-center gap-2 text-sm">
          <Checkbox v-model="isPresent" />
          I still work here
        </label>
      </div>
    </div>
    <ResumeBulletsEditor v-if="!isEducation || entry.bullets.length" v-model="entry.bullets" :label="`${headerLabel} line`" />
    <Button v-else variant="ghost" size="sm" class="self-start" @click="entry.bullets.push(newBullet())">
      <PhPlus :size="16" />
      Add details (honors, thesis)
    </Button>
    <ul v-if="hints.length" class="flex flex-col gap-1 text-sm text-muted-foreground">
      <li v-for="hint in hints" :key="hint" class="flex items-start gap-1.5"><PhInfo :size="16" class="mt-0.5 shrink-0" />{{ hint }}</li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { PhInfo, PhPlus } from "@phosphor-icons/vue";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ResumeBulletsEditor from "@/components/resume-builder/ResumeBulletsEditor.vue";
import YearMonthInput from "@/components/resume-builder/YearMonthInput.vue";
import { entryHints, newBullet } from "@/lib/builtResumeEdit";
import type { ResumeEducation, ResumeRole, RoleSectionType, YearMonth } from "@/lib/builtResume";

type ResumeEntryFormProps = { sectionType: RoleSectionType | "education" };

const { sectionType } = defineProps<ResumeEntryFormProps>();
const entry = defineModel<ResumeRole | ResumeEducation>({ required: true });

const isEducation = computed(() => sectionType === "education");
const titleLabel = computed(() => (sectionType === "projects" ? "Project" : "Job title"));
const organizationLabel = computed(() => (sectionType === "projects" ? "For (optional)" : "Organization"));
const titlePlaceholder = computed(() => (sectionType === "projects" ? "Bus delay dashboard" : "Senior Frontend Engineer"));
const organizationPlaceholder = computed(() => (sectionType === "projects" ? "Personal project" : "Company name"));
// Names the entry's lines for screen readers: "Senior Engineer line 2"
const headerLabel = computed(() =>
  isEducation.value
    ? (entry.value as ResumeEducation).degree || "Education"
    : (entry.value as ResumeRole).title || (sectionType === "projects" ? "Project" : "Job"),
);

const isPresent = computed({
  get: () => entry.value.end === "present",
  set: (value: boolean | "indeterminate") => {
    entry.value.end = value === true ? "present" : null;
  },
});

const endDate = computed({
  get: (): YearMonth | null => (entry.value.end === "present" ? null : entry.value.end),
  set: (value: YearMonth | null) => {
    entry.value.end = value;
  },
});

const hints = computed(() => entryHints(entry.value, isEducation.value));
</script>
