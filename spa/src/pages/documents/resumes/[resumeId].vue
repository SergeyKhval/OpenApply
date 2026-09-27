<template>
  <div class="flex min-h-full flex-col">
    <PageHeader>
      <Button variant="ghost" size="icon" as-child>
        <RouterLink to="/documents" aria-label="Back to documents"><PhArrowLeft :size="20" /></RouterLink>
      </Button>
      <div class="flex min-w-0 grow flex-col">
        <Input
          v-if="draft"
          v-model="title"
          aria-label="Resume name"
          class="h-9 max-w-80 border-transparent bg-transparent px-2 text-lg font-bold shadow-none hover:border-input"
        />
        <p class="px-2 text-xs text-muted-foreground" role="status">{{ saveLabel }}</p>
      </div>
      <div v-if="draft" class="hidden items-center gap-2 lg:flex">
        <Button variant="secondary" :disabled="isExporting" @click="downloadDocx"><PhFileDoc />Download .docx</Button>
        <Button variant="secondary" @click="savePdf"><PhFilePdf />Save as PDF</Button>
      </div>
    </PageHeader>

    <div class="grow px-4 lg:px-6">
      <div v-if="pending && !draft" class="flex justify-center py-12"><Spinner /></div>
      <!-- Flags load after the resume, so an existing built resume opens either way -->
      <Empty v-else-if="!draft" class="py-12">
        <EmptyTitle>{{ enabled ? "We couldn't find this resume" : "The resume builder isn't available on your account yet" }}</EmptyTitle>
        <EmptyAction><Button as-child><RouterLink to="/documents">Back to documents</RouterLink></Button></EmptyAction>
      </Empty>

      <template v-else>
        <p v-if="errorMessage" class="mb-4 text-sm text-destructive" role="alert">{{ errorMessage }}</p>

        <!-- Phone: one pane at a time -->
        <div class="mb-4 grid grid-cols-2 rounded-field bg-muted p-1 lg:hidden" role="tablist" aria-label="Editor view">
          <button
            v-for="option in VIEWS"
            :key="option.value"
            type="button"
            role="tab"
            class="h-10 rounded-[10px] text-sm font-semibold"
            :class="view === option.value ? 'bg-card shadow-card' : 'text-muted-foreground'"
            :aria-selected="view === option.value"
            @click="view = option.value"
          >
            {{ option.label }}
          </button>
        </div>

        <div class="grid gap-6 lg:grid-cols-2">
          <div class="flex min-w-0 flex-col gap-4" :class="view === 'preview' && 'max-lg:hidden'">
            <ResumeContactForm v-model="draft.contact" />
            <ResumeSectionCard
              v-for="(section, index) in draft.sections"
              :key="section.id"
              v-model="draft.sections[index]!"
              :index="index"
              :count="draft.sections.length"
              @move="moveInPlace(draft.sections, index, $event)"
              @remove="removeSection(index)"
              @remove-entry="removeEntry(index, $event)"
            />
            <DropdownMenu v-if="missingTypes.length">
              <DropdownMenuTrigger as-child>
                <Button variant="secondary" class="self-start"><PhPlus :size="18" />Add section</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem v-for="type in missingTypes" :key="type" @select="addSection(type)">
                  {{ SECTION_LABELS[type] }}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div class="min-w-0 lg:sticky lg:top-26 lg:max-h-[calc(100dvh-8rem)] lg:self-start lg:overflow-y-auto" :class="view === 'edit' && 'max-lg:hidden'">
            <ResumePreview :resume="draft" :title="title" />
          </div>
        </div>
      </template>
    </div>

    <!-- Sticky footer: undo after a delete, and on phones the downloads.
         Sticky, not fixed: the app's scroll container has a transform. -->
    <div v-if="draft" class="sticky bottom-0 z-20 mt-6 flex flex-col gap-2 lg:bottom-6 lg:px-6">
      <div
        v-if="undo"
        class="mx-4 flex items-center gap-3 self-center rounded-field bg-foreground px-4 py-2 text-background shadow-card lg:mx-0"
        role="status"
      >
        <span class="text-sm">{{ undo.label }} deleted</span>
        <Button size="sm" variant="secondary" @click="runUndo">Undo</Button>
      </div>
      <div class="flex gap-2 border-t border-border bg-background p-3 lg:hidden">
        <Button class="flex-1" variant="secondary" :disabled="isExporting" @click="downloadDocx"><PhFileDoc />.docx</Button>
        <Button class="flex-1" variant="secondary" @click="savePdf"><PhFilePdf />PDF</Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { onBeforeRouteLeave, useRoute } from "vue-router";
import { useOnline } from "@vueuse/core";
import { PhArrowLeft, PhFileDoc, PhFilePdf, PhPlus } from "@phosphor-icons/vue";
import PageHeader from "@/components/PageHeader.vue";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Empty, EmptyAction, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import ResumeContactForm from "@/components/resume-builder/ResumeContactForm.vue";
import ResumePreview from "@/components/resume-builder/ResumePreview.vue";
import ResumeSectionCard from "@/components/resume-builder/ResumeSectionCard.vue";
import { useBuiltResume } from "@/composables/useBuiltResume";
import { useFeatureFlag } from "@/composables/useFeatureFlag";
import { trackEvent } from "@/analytics";
import { structuredToDoc, type SectionType } from "@/lib/builtResume";
import { SECTION_LABELS, missingSectionTypes, moveInPlace, newSection, removeAt, undoRemove, type Removed } from "@/lib/builtResumeEdit";
import { exportFileName, printTailoredResume, saveBlob, tailoredResumeDocx } from "@/lib/tailoredResumeExport";

const route = useRoute("/documents/resumes/[resumeId]");
const enabled = useFeatureFlag("resume-builder");
const resumeId = computed(() => route.params.resumeId);
const { draft, title, pending, saveState, flush } = useBuiltResume(resumeId);

onBeforeRouteLeave(async () => {
  await flush();
});

const VIEWS = [
  { value: "edit", label: "Edit" },
  { value: "preview", label: "Preview" },
] as const;
const view = ref<"edit" | "preview">("edit");

// Firestore queues writes while offline, so a save then just waits
const online = useOnline();
const saveLabel = computed(() =>
  saveState.value === "saving" && !online.value
    ? "Offline, will save"
    : { idle: "Saves as you type", saving: "Saving…", saved: "Saved", error: "Couldn't save. We'll retry on your next change." }[saveState.value],
);

const missingTypes = computed(() => (draft.value ? missingSectionTypes(draft.value) : []));

function addSection(type: SectionType) {
  draft.value?.sections.push(newSection(type));
  trackEvent("resume_builder_section_added", { type });
}

// Deleting is undoable for a few seconds instead of asking first
const undo = ref<{ label: string; removed: Removed<unknown> } | null>(null);
let undoTimer: ReturnType<typeof setTimeout> | null = null;

function offerUndo(label: string, removed: Removed<unknown> | null) {
  if (!removed) return;
  if (undoTimer) clearTimeout(undoTimer);
  undo.value = { label, removed };
  undoTimer = setTimeout(() => (undo.value = null), 5000);
}

function runUndo() {
  if (undo.value) undoRemove(undo.value.removed);
  undo.value = null;
}

onBeforeUnmount(() => {
  if (undoTimer) clearTimeout(undoTimer);
});

function removeSection(index: number) {
  if (!draft.value) return;
  const heading = draft.value.sections[index]?.heading ?? "Section";
  offerUndo(heading, removeAt(draft.value.sections, index) as Removed<unknown> | null);
}

function removeEntry(sectionIndex: number, entryIndex: number) {
  const section = draft.value?.sections[sectionIndex];
  if (!section || !("entries" in section)) return;
  offerUndo("Entry", removeAt(section.entries as unknown[], entryIndex));
}

const isExporting = ref(false);
const errorMessage = ref("");
const doc = () => structuredToDoc(draft.value!);
const fileName = (extension: "docx" | "pdf") => exportFileName(doc(), { position: "Resume" }, extension);

async function downloadDocx() {
  if (!draft.value) return;
  isExporting.value = true;
  errorMessage.value = "";
  try {
    saveBlob(await tailoredResumeDocx(doc()), fileName("docx"));
    trackEvent("resume_builder_downloaded", { format: "docx", template: "classic" });
  } catch {
    errorMessage.value = "The .docx didn't build. Try again, or use Save as PDF.";
  } finally {
    isExporting.value = false;
  }
}

function savePdf() {
  if (!draft.value) return;
  errorMessage.value = "";
  if (!printTailoredResume(doc(), fileName("pdf"))) {
    errorMessage.value = "Your browser blocked the print tab. Allow pop-ups for OpenApply, or use Download .docx.";
    return;
  }
  trackEvent("resume_builder_downloaded", { format: "pdf", template: "classic" });
}
</script>

<route lang="yaml">
meta:
  requiresAuth: true
</route>
