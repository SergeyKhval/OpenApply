<!-- Tailored version of a resume for one job (flag tailored-resume): the
     change list first, then the document with the switched-on changes -->
<template>
  <AiSheet :open="open" title="Tailored version" :eyebrow="`${application.companyName} · ${application.position}`" @update:open="emit('update:open', $event)">
    <p class="flex flex-wrap items-baseline gap-x-2 text-sm text-muted-foreground">
      From resume <ResumeLink :resume="resume" />
    </p>

    <div v-if="isRunning" class="flex flex-col items-center gap-4 py-10 text-center" role="status">
      <Spinner class="size-10" />
      <p class="text-[15px] text-soft-foreground">Editing your resume for {{ application.companyName }}. This takes up to a minute.</p>
    </div>

    <AiLimitReached v-else-if="showLimit && allowance" :allowance="allowance" source="tailored_resume" />

    <template v-else-if="tailored && doc">
      <section class="flex flex-col gap-1 rounded-card bg-muted p-4">
        <p class="text-[17px] font-bold">{{ changesLine }}</p>
        <p class="text-sm text-soft-foreground">
          Switch off anything you don't want. We never add a skill, job, title, date, number or degree you don't have.
        </p>
      </section>

      <section v-if="rows.changes.length" class="flex flex-col gap-2" aria-label="Changes">
        <h3 class="text-[17px] font-bold">Changes</h3>
        <ul class="flex flex-col divide-y divide-border">
          <li v-for="row in rows.changes" :key="row.index" class="flex flex-wrap items-start gap-3 py-3" :class="{ 'opacity-60': !row.included && reportingIndex !== row.index }">
            <div class="flex min-w-0 grow flex-col gap-1">
              <span class="inline-flex w-fit rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">{{ row.label }}</span>
              <template v-if="row.kind === 'reworded'">
                <del class="text-sm text-muted-foreground">{{ row.before }}</del>
                <ins class="text-[15px] no-underline">{{ row.after }}</ins>
              </template>
              <template v-else-if="row.kind === 'skills'">
                <span class="text-[15px] font-semibold">{{ row.after }}</span>
                <span class="text-sm text-muted-foreground">{{ row.before }}</span>
              </template>
              <span v-else class="text-[15px]" :class="{ 'line-through text-muted-foreground': row.kind === 'cut' }">{{ row.before }}</span>
              <span v-if="row.requirement" class="text-sm text-soft-foreground">For: {{ row.requirement }}</span>
            </div>
            <div class="flex shrink-0 flex-col items-end gap-2">
              <Switch
                :model-value="row.included"
                :aria-label="`${row.included ? 'Keep' : 'Skip'}: ${row.label}`"
                @update:model-value="toggle(row.index, row.kind, $event)"
              />
              <span v-if="reportedIndexes.has(row.index)" class="text-xs text-muted-foreground">Reported</span>
              <Button
                v-else
                variant="ghost"
                size="icon-sm"
                :aria-label="`Report a wrong change: ${row.label}`"
                @click="reportingIndex = reportingIndex === row.index ? null : row.index"
              >
                <PhFlag />
              </Button>
            </div>
            <TailoredChangeReport
              v-if="reportingIndex === row.index && tailored"
              class="basis-full"
              :tailored-resume-id="tailored.id"
              :row="row"
              @reported="onReported(row.index, row.kind)"
              @cancel="reportingIndex = null"
            />
          </li>
        </ul>
      </section>

      <section v-if="rows.kept.length" class="flex flex-col gap-2" aria-label="Kept as your original">
        <h3 class="text-[17px] font-bold">Kept as your original</h3>
        <ul class="flex flex-col gap-3">
          <li v-for="row in rows.kept" :key="row.index" class="flex flex-col gap-0.5 text-sm text-muted-foreground">
            <span class="text-foreground">{{ row.before }}</span>
            <span>{{ row.explanation }}</span>
          </li>
        </ul>
      </section>

      <section v-if="gaps.length" class="flex flex-col gap-2 rounded-card border border-border p-4" aria-label="Still missing">
        <h3 class="text-[17px] font-bold">Still missing</h3>
        <p class="text-[15px] text-soft-foreground">
          {{ gaps.join(", ") }}. We won't add these. If you have them, add them yourself; if not, say how you'd close the gap in a cover letter.
        </p>
      </section>

      <section class="flex flex-col gap-2" aria-label="Preview">
        <h3 class="text-[17px] font-bold">Preview</h3>
        <article class="flex flex-col gap-3 rounded-card border border-border bg-card p-4 text-sm">
          <div v-for="(section, sectionIndex) in doc.sections" :key="sectionIndex" class="flex flex-col gap-1">
            <h4 v-if="section.heading" class="text-xs font-bold tracking-wide text-muted-foreground uppercase">{{ section.heading }}</h4>
            <p
              v-for="(line, lineIndex) in section.lines"
              :key="lineIndex"
              :class="{ 'pl-3': line.bullet, 'bg-success-soft': line.kind !== 'original' }"
            >
              <span v-if="line.bullet" aria-hidden="true">• </span>{{ line.text }}
            </p>
          </div>
        </article>
      </section>
    </template>

    <template v-else-if="noChanges">
      <section class="flex flex-col gap-1 rounded-card bg-muted p-4" role="status">
        <p class="text-[17px] font-bold">Nothing to change</p>
        <p class="text-[15px] text-soft-foreground">
          We couldn't improve this resume for this job without adding something it doesn't say. No check was used.
        </p>
      </section>
    </template>

    <template v-else>
      <p class="text-[15px] text-soft-foreground">
        We'll reorder, reword and trim what's already in your resume to fit this job. We never add a skill, job, title,
        date, number or degree you don't have. You'll see every change, and can switch any of them off.
      </p>
    </template>

    <Alert v-if="errorMessage && !isRunning" variant="destructive">
      <PhWarningCircle />
      <AlertDescription>{{ errorMessage }}</AlertDescription>
    </Alert>

    <template v-if="!isRunning && !showLimit" #footer>
      <AiChecksLeft v-if="allowance" :allowance="allowance" />
      <p v-if="tailored" class="text-[13px] text-muted-foreground">
        Save as PDF opens your browser's print dialog: pick “Save as PDF” as the printer.
        <button type="button" class="font-medium text-secondary-foreground hover:underline" @click="create">Make a new version · 1 check</button>
      </p>
      <div class="flex flex-col gap-2 sm:flex-row">
        <template v-if="tailored">
          <Button :disabled="isExporting" @click="downloadDocx">
            <Spinner v-if="isExporting" />
            <PhFileDoc v-else />
            Download .docx
          </Button>
          <Button variant="outline" @click="savePdf">
            <PhFilePdf />
            Save as PDF
          </Button>
          <Button variant="outline" @click="copyText">
            <PhCopy />
            {{ copied ? "Copied" : "Copy text" }}
          </Button>
        </template>
        <Button v-else @click="create">
          <PhSparkle />
          Make a tailored version · 1 check
        </Button>
      </div>
    </template>
  </AiSheet>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useCollection, useCurrentUser, useDocument } from "vuefire";
import { collection, doc as docRef, limit, orderBy, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { PhCopy, PhFileDoc, PhFilePdf, PhFlag, PhSparkle, PhWarningCircle } from "@phosphor-icons/vue";
import AiChecksLeft from "@/components/AiChecksLeft.vue";
import AiLimitReached from "@/components/AiLimitReached.vue";
import ResumeLink from "@/components/ResumeLink.vue";
import AiSheet from "@/components/ai/AiSheet.vue";
import TailoredChangeReport from "@/components/ai/TailoredChangeReport.vue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { db, functions } from "@/firebase/config";
import { trackEvent } from "@/analytics";
import { useAiAllowance } from "@/composables/useAiAllowance";
import { assembleTailoredResume, docText, toChangeRows, type ChangeKind } from "@/lib/tailoredResume";
import { exportFileName, printTailoredResume, saveBlob, tailoredResumeDocx } from "@/lib/tailoredResumeExport";
import type { JobApplication, Resume, ResumeJobMatch, TailoredResume } from "@/types";

type TailoredResumeSheetProps = {
  open: boolean;
  resume: Resume;
  application: Pick<JobApplication, "id" | "companyName" | "position">;
};

type TailoredResumeSheetEmits = {
  (event: "update:open", value: boolean): void;
};

const { open, resume, application } = defineProps<TailoredResumeSheetProps>();
const emit = defineEmits<TailoredResumeSheetEmits>();

type CreateResult = { tailoredResumeId: string | null; stats: { proposed: number; applied: number; reverted: number } };

const user = useCurrentUser();
const { allowance, canUseAi } = useAiAllowance();

// Newest tailored version of this resume for this job
const tailoredQuery = computed(() =>
  user.value
    ? query(
        collection(db, "tailoredResumes"),
        where("userId", "==", user.value.uid),
        where("jobApplicationId", "==", application.id),
        orderBy("createdAt", "desc"),
        limit(10),
      )
    : null,
);
const tailoredVersions = useCollection<TailoredResume>(tailoredQuery);
const tailored = computed(() => tailoredVersions.value.find((version) => version.resumeId === resume.id) ?? null);

// Requirement labels come from the match this version was made from
const matchRef = computed(() => (tailored.value ? docRef(db, "resumeJobMatches", tailored.value.matchId) : null));
const match = useDocument<ResumeJobMatch>(matchRef);
const requirements = computed(() => match.value?.analysis?.requirements ?? []);
const gaps = computed(() =>
  requirements.value.filter((requirement) => requirement.status === "missing").map((requirement) => requirement.requirement),
);

// The user's switched-off edits, saved as they change
const excluded = ref(new Set<number>());
watch(
  () => tailored.value?.excludedOpIds,
  (ids) => {
    excluded.value = new Set(ids ?? []);
  },
  { immediate: true },
);

const doc = computed(() =>
  tailored.value ? assembleTailoredResume(tailored.value.lines, tailored.value.ops, tailored.value.sectionOrder, excluded.value) : null,
);
const rows = computed(() =>
  tailored.value
    ? toChangeRows(
        tailored.value.ops,
        tailored.value.lines,
        requirements.value.map((requirement) => requirement.requirement),
        excluded.value,
      )
    : { changes: [], kept: [] },
);
const changesLine = computed(() => {
  const count = rows.value.changes.length;
  const on = rows.value.changes.filter((row) => row.included).length;
  const changes = count === 1 ? "1 change" : `${count} changes`;
  return on === count ? changes : `${changes}, ${on} switched on`;
});

async function toggle(index: number, kind: ChangeKind, on: boolean) {
  if (!tailored.value) return;
  const next = new Set(excluded.value);
  if (on) next.delete(index);
  else next.add(index);
  excluded.value = next;
  trackEvent("tailored_resume_change_toggled", { kind, on });
  try {
    await updateDoc(docRef(db, "tailoredResumes", tailored.value.id), {
      excludedOpIds: [...next].sort((a, b) => a - b),
      updatedAt: serverTimestamp(),
    });
  } catch {
    errorMessage.value = "Couldn't save that switch. It applies to this preview only.";
  }
}

// Reports this session; a reported change is switched off
const reportingIndex = ref<number | null>(null);
const reportedIndexes = ref(new Set<number>());
async function onReported(index: number, kind: ChangeKind) {
  reportingIndex.value = null;
  reportedIndexes.value = new Set([...reportedIndexes.value, index]);
  if (!excluded.value.has(index)) await toggle(index, kind, false);
}

const isRunning = ref(false);
const errorMessage = ref("");
const limitHit = ref(false);
const noChanges = ref(false);
const copied = ref(false);
const showLimit = computed(() => limitHit.value || (!tailored.value && allowance.value !== null && !canUseAi.value));

watch(
  () => open,
  (isOpen) => {
    if (isOpen && tailored.value) {
      trackEvent("tailored_resume_opened", { resumeId: resume.id, jobApplicationId: application.id });
    }
    if (!isOpen) {
      errorMessage.value = "";
      limitHit.value = false;
      noChanges.value = false;
      copied.value = false;
    }
  },
);

const createTailoredResume = httpsCallable<{ resumeId: string; applicationId: string }, CreateResult>(functions, "createTailoredResume");

// Server refusals worth their own wording; the rest use the server's message
const REFUSALS: Record<string, string> = {
  not_available: "Tailored versions aren't available on your account yet.",
  no_match: "Check your resume against this job first, then make a tailored version.",
  stale_match: "Your resume changed since the last check. Check it against this job again first.",
};

async function create() {
  if (!canUseAi.value) {
    limitHit.value = true;
    return;
  }
  isRunning.value = true;
  errorMessage.value = "";
  noChanges.value = false;
  const started = Date.now();
  trackEvent("tailored_resume_started", {
    resumeId: resume.id,
    jobApplicationId: application.id,
    matchScore: match.value?.analysis?.matchScore ?? -1,
  });
  try {
    const { data } = await createTailoredResume({ resumeId: resume.id, applicationId: application.id });
    if (data.tailoredResumeId === null) {
      noChanges.value = true;
      trackEvent("tailored_resume_no_changes", { proposed: data.stats.proposed, reverted: data.stats.reverted });
    } else {
      trackEvent("tailored_resume_generated", { ...data.stats, durationMs: Date.now() - started });
    }
  } catch (error) {
    const { details, message } = error as { details?: { code?: string }; message?: string };
    const code = details?.code;
    if (code === "ai-limit-reached") {
      limitHit.value = true;
    } else if (code && REFUSALS[code]) {
      errorMessage.value = REFUSALS[code]!;
    } else if (code === "scrambled" || code === "nothing_to_edit" || code === "rate_limited") {
      errorMessage.value = message ?? "The tailored version didn't finish. Try again in a moment.";
    } else {
      errorMessage.value = "The tailored version didn't finish. Nothing was counted; try again in a moment.";
    }
    trackEvent("tailored_resume_failed", { error: message ?? String(error), ...(code ? { code } : {}) });
  } finally {
    isRunning.value = false;
  }
}

const isExporting = ref(false);
const includedCount = () => rows.value.changes.filter((row) => row.included).length;
const exportMeta = () => ({ companyName: application.companyName, position: application.position });

async function downloadDocx() {
  if (!doc.value) return;
  isExporting.value = true;
  errorMessage.value = "";
  try {
    const blob = await tailoredResumeDocx(doc.value);
    saveBlob(blob, exportFileName(doc.value, exportMeta(), "docx"));
    trackEvent("tailored_resume_downloaded", { format: "docx", changesIncluded: includedCount() });
  } catch {
    errorMessage.value = "The .docx didn't build. Try again, or use Save as PDF or Copy text.";
  } finally {
    isExporting.value = false;
  }
}

function savePdf() {
  if (!doc.value) return;
  errorMessage.value = "";
  if (!printTailoredResume(doc.value, exportFileName(doc.value, exportMeta(), "pdf"))) {
    errorMessage.value = "Your browser blocked the print tab. Allow pop-ups for OpenApply, or use Download .docx.";
    return;
  }
  trackEvent("tailored_resume_downloaded", { format: "pdf", changesIncluded: includedCount() });
}

async function copyText() {
  if (!doc.value) return;
  await navigator.clipboard.writeText(docText(doc.value));
  copied.value = true;
}
</script>
