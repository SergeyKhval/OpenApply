<template>
  <section class="flex flex-col gap-3 rounded-card bg-card p-4 shadow-card dark:border dark:border-border" aria-label="About this import">
    <p class="flex items-start gap-2 text-sm">
      <PhCheckCircle :size="18" class="mt-0.5 shrink-0 text-success" />
      <span>
        We copied your resume's text as is. Nothing was reworded.
        <!-- Without the model, each job's header line goes in whole as its
             title (and the next line as its employer), unverified -->
        <span v-if="importedFrom.fallback" class="text-muted-foreground">
          We couldn't sort this one automatically, so each job's first lines went in as its title and employer. Check those, and the dates.
        </span>
        <span v-else-if="flaggedCount" class="text-muted-foreground">Fields marked “Check this” were left empty for you to fill in.</span>
      </span>
    </p>

    <div v-if="unsorted.length" class="flex flex-col gap-2">
      <h2 class="text-sm font-bold">Lines to place</h2>
      <p class="text-sm text-muted-foreground">We couldn't tell which job these belong to. Pick one, or leave them out.</p>
      <div v-for="line in unsorted" :key="line" class="flex flex-col gap-2 rounded-field border border-border p-3">
        <p class="text-sm">{{ clean(line) }}</p>
        <select
          class="h-11 rounded-field border border-input bg-card px-3 text-[15px] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 md:text-sm"
          :aria-label="`Put “${clean(line)}” under`"
          :disabled="!targets.length"
          @change="place(line, ($event.target as HTMLSelectElement).value)"
        >
          <option value="">{{ targets.length ? "Put it under…" : "Add a job first" }}</option>
          <option v-for="target in targets" :key="`${target.sectionId}/${target.entryId}`" :value="`${target.sectionId}/${target.entryId}`">
            {{ target.label }}
          </option>
        </select>
      </div>
    </div>

    <details v-if="notImported.length" class="text-sm">
      <summary class="cursor-pointer font-semibold">{{ notImported.length }} {{ notImported.length === 1 ? "line" : "lines" }} we didn't import</summary>
      <p class="mt-2 text-muted-foreground">Mostly page labels and repeats. Copy anything you want to keep.</p>
      <ul class="mt-2 flex flex-col gap-1">
        <li v-for="(line, index) in notImported" :key="index" class="rounded-field bg-muted px-3 py-1.5 break-words">{{ line }}</li>
      </ul>
    </details>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { PhCheckCircle } from "@phosphor-icons/vue";
import { entryTargets, pendingUnsorted, placeLine } from "@/lib/resumeImport";
import type { StructuredResume } from "@/lib/builtResume";
import type { BuiltResume } from "@/types";

type ImportNoticeProps = { importedFrom: NonNullable<BuiltResume["importedFrom"]> };

const { importedFrom } = defineProps<ImportNoticeProps>();
const resume = defineModel<StructuredResume>({ required: true });

const flaggedCount = computed(() => importedFrom.flaggedFields.length);
const unsorted = computed(() => pendingUnsorted(importedFrom.unsorted, resume.value));
const notImported = computed(() => importedFrom.notImported ?? []);
const targets = computed(() => entryTargets(resume.value));

const clean = (line: string) => line.replace(/^[\s•·*–-]+/, "").trim();

function place(line: string, value: string) {
  const [sectionId, entryId] = value.split("/");
  if (!sectionId || !entryId) return;
  placeLine(resume.value, line, { sectionId, entryId });
}
</script>
