<template>
  <AiSheet :open="open" title="New resume" @update:open="emit('update:open', $event)">
    <template #description>Imports copy your text as it is. Nothing gets reworded.</template>

    <div v-if="busy" class="flex flex-col items-center gap-3 py-10 text-center" role="status">
      <Spinner />
      <p class="font-semibold">{{ busyLabel }}</p>
      <p v-if="busy !== 'scratch'" class="text-sm text-muted-foreground">This takes about 20 seconds.</p>
    </div>

    <template v-else>
      <p v-if="errorMessage" class="rounded-field bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{{ errorMessage }}</p>

      <button type="button" :class="CARD" @click="startFromScratch">
        <PhPencilSimpleLine :size="24" class="shrink-0 text-primary" />
        <span class="flex flex-col">
          <span class="font-bold">Start from scratch</span>
          <span class="text-sm text-muted-foreground">An empty resume with your name and email filled in.</span>
        </span>
      </button>

      <section v-if="uploads.length" class="flex flex-col gap-2" aria-labelledby="new-resume-uploads">
        <h3 id="new-resume-uploads" class="font-bold">From my uploaded resume</h3>
        <p class="text-sm text-muted-foreground">Makes an editable copy. The PDF stays as it is.</p>
        <button v-for="upload in uploads" :key="upload.id" type="button" :class="CARD" @click="run({ source: 'resume', resumeId: upload.id })">
          <PhFilePdf :size="24" class="shrink-0 text-primary" />
          <span class="min-w-0 truncate font-semibold">{{ upload.fileName }}</span>
        </button>
      </section>

      <section class="flex flex-col gap-3" aria-labelledby="new-resume-linkedin">
        <div class="flex flex-col gap-1">
          <h3 id="new-resume-linkedin" class="font-bold">From LinkedIn</h3>
          <p class="text-sm text-muted-foreground">We don't connect to LinkedIn and never see your account. You bring the PDF or the text.</p>
        </div>

        <div class="grid grid-cols-2 rounded-field bg-muted p-1" role="tablist" aria-label="LinkedIn import">
          <button
            v-for="option in LINKEDIN_MODES"
            :key="option.value"
            type="button"
            role="tab"
            class="h-10 rounded-[10px] text-sm font-semibold"
            :class="linkedinMode === option.value ? 'bg-card shadow-card' : 'text-muted-foreground'"
            :aria-selected="linkedinMode === option.value"
            @click="linkedinMode = option.value"
          >
            {{ option.label }}
          </button>
        </div>

        <div v-if="linkedinMode === 'pdf'" class="flex flex-col gap-3" role="tabpanel">
          <ol class="flex list-decimal flex-col gap-1 pl-5 text-sm">
            <li>Open your LinkedIn profile on a computer.</li>
            <li>Click <strong>More</strong>, then <strong>Save to PDF</strong>.</li>
            <li>Pick the downloaded file here.</li>
          </ol>
          <p class="text-sm text-muted-foreground lg:hidden">LinkedIn only offers Save to PDF on a computer. On a phone, paste your profile instead.</p>
          <label :class="[buttonVariants({ variant: 'secondary' }), 'self-start']">
            <PhUploadSimple />
            Choose the PDF
            <input type="file" accept="application/pdf,.pdf" class="sr-only" @change="onFile" />
          </label>
        </div>

        <div v-else class="flex flex-col gap-3" role="tabpanel">
          <p class="text-sm">Open your profile, select everything from your name down to Education, copy it and paste it here.</p>
          <Textarea v-model="pasted" aria-label="Your LinkedIn profile" rows="6" :maxlength="MAX_PASTE_CHARS" placeholder="Sarah Chen&#10;Senior Frontend Engineer at Globex&#10;…" />
          <Button class="self-start" :disabled="!pasted.trim()" @click="run({ source: 'linkedin_paste', text: pasted })">Import my profile</Button>
        </div>
      </section>
    </template>
  </AiSheet>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useMediaQuery } from "@vueuse/core";
import { useCurrentUser } from "vuefire";
import { PhFilePdf, PhPencilSimpleLine, PhUploadSimple } from "@phosphor-icons/vue";
import AiSheet from "@/components/ai/AiSheet.vue";
import { Button, buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { createBuiltResume } from "@/composables/useBuiltResume";
import { importResume, type ResumeImportInput } from "@/composables/useResumeImport";
import { useResumes } from "@/composables/useResumes";
import { checkImportFile, fileToBase64 } from "@/lib/resumeImport";
import type { UploadedResume } from "@/types";

type NewResumeSheetProps = { open: boolean };

const { open } = defineProps<NewResumeSheetProps>();
const emit = defineEmits<{ (event: "update:open", value: boolean): void }>();

const CARD =
  "flex items-center gap-3 rounded-card border border-border bg-card p-4 text-left transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:outline-none";
const MAX_PASTE_CHARS = 30_000;
const LINKEDIN_MODES = [
  { value: "pdf", label: "Upload LinkedIn PDF" },
  { value: "paste", label: "Paste your profile" },
] as const;

const user = useCurrentUser();
const router = useRouter();
const resumes = useResumes();

const uploads = computed(() =>
  resumes.value.filter((resume): resume is UploadedResume & { id: string } => resume.kind !== "built" && resume.status === "parsed"),
);

// LinkedIn only offers Save to PDF on a computer, so phones start on paste
const linkedinMode = ref<"pdf" | "paste">(useMediaQuery("(min-width: 1024px)").value ? "pdf" : "paste");
const pasted = ref("");
const busy = ref<"scratch" | ResumeImportInput["source"] | null>(null);
const errorMessage = ref("");

const busyLabel = computed(() =>
  busy.value === "scratch" ? "Starting your resume…" : busy.value === "resume" ? "Copying your resume…" : "Reading your profile…",
);

async function openEditor(resumeId: string) {
  await router.push({ name: "/documents/resumes/[resumeId]", params: { resumeId } });
  emit("update:open", false);
}

async function startFromScratch() {
  if (!user.value) return;
  busy.value = "scratch";
  errorMessage.value = "";
  try {
    await openEditor(await createBuiltResume(user.value.uid, { name: user.value.displayName, email: user.value.email }));
  } catch (error) {
    console.error("Creating a resume failed:", error);
    errorMessage.value = "We couldn't start a new resume. Try again in a moment.";
  } finally {
    busy.value = null;
  }
}

async function run(input: ResumeImportInput) {
  busy.value = input.source;
  errorMessage.value = "";
  try {
    await openEditor(await importResume(input));
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Something went wrong while importing. Try again in a moment.";
  } finally {
    busy.value = null;
  }
}

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const problem = checkImportFile(file);
  if (problem) {
    errorMessage.value = problem;
    return;
  }
  await run({ source: "linkedin_pdf", pdfBase64: await fileToBase64(file) });
  input.value = "";
}
</script>
