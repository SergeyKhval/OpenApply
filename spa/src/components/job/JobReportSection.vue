<!-- Job page, Details card: report the posting (flag job-signals). Fixed reasons, no free text. -->
<template>
  <div class="flex flex-col gap-2 border-t border-border pt-3 text-sm">
    <p v-if="ownReport" class="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
      <span>You reported: {{ REPORT_LABELS[ownReport.reason] }}</span>
      <Button variant="link" size="sm" class="h-auto p-0" :disabled="busy" @click="withdraw">Withdraw</Button>
    </p>
    <template v-else>
      <div v-if="canReportNoReply" class="flex flex-col gap-2 rounded-xl bg-signal-soft p-3 text-signal-text">
        <span class="font-semibold">No reply for 30+ days? Share it anonymously so others see it.</span>
        <Button size="sm" variant="outline" class="self-start" :disabled="busy" @click="submit('no_reply_30d', 'prompt')">
          Share no reply
        </Button>
      </div>
      <Button variant="link" size="sm" class="h-auto self-start p-0 text-muted-foreground" @click="openDialog">
        <PhFlag />
        Report this posting
      </Button>
    </template>
    <p v-if="error" class="text-[13px] text-destructive" role="alert">{{ error }}</p>

    <Dialog v-model:open="dialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report this posting</DialogTitle>
          <DialogDescription>
            Your name is never shown. A report appears on the posting once three people make the same one within six
            months.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup v-model="reason" class="gap-3" aria-label="What happened">
          <div v-for="option in REPORT_REASONS" :key="option" class="flex items-start gap-2.5">
            <RadioGroupItem
              :id="`report-${option}`"
              :value="option"
              class="mt-0.5"
              :disabled="option === 'no_reply_30d' && !noReplyEligible"
            />
            <Label :for="`report-${option}`" class="flex flex-col items-start gap-0.5 font-normal">
              <span class="font-semibold">{{ REPORT_LABELS[option] }}</span>
              <span v-if="option === 'no_reply_30d' && !noReplyEligible" class="text-[13px] text-muted-foreground">
                For jobs marked applied 30+ days ago with no change since
              </span>
            </Label>
          </div>
        </RadioGroup>
        <p v-if="error" class="text-[13px] text-destructive" role="alert">{{ error }}</p>
        <DialogFooter class="gap-2 sm:justify-start">
          <Button :disabled="!reason || busy" @click="reason && submit(reason, 'dialog')">Send report</Button>
          <Button variant="ghost" @click="dialogOpen = false">Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useCurrentUser, useDocument } from "vuefire";
import { doc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { PhFlag } from "@phosphor-icons/vue";
import { db, functions } from "@/firebase/config";
import { trackEvent } from "@/analytics";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toJsDate } from "@/lib/jobDates";
import { REPORT_LABELS, REPORT_REASONS, type ReportReason } from "@/lib/jobSignals";
import type { JobApplication } from "@/types";

const { job, now } = defineProps<{ job: JobApplication; now: Date }>();

type OwnReport = { reason: ReportReason; status: "active" | "withdrawn" | "removed" };

const user = useCurrentUser();
const { data: report } = useDocument<OwnReport>(
  computed(() => (user.value && job.jobKeyHash ? doc(db, "jobReports", `${job.jobKeyHash}_${user.value.uid}`) : null)),
);
const ownReport = computed(() => (report.value?.status === "active" ? report.value : null));

const NO_REPLY_DAYS = 30;
// Same rule as the reportJob callable: in "applied" for 30+ days
const noReplyEligible = computed(() => {
  if (job.status !== "applied") return false;
  const since = toJsDate(job.appliedAt) ?? toJsDate(job.createdAt);
  return Boolean(since && now.getTime() - since.getTime() >= NO_REPLY_DAYS * 86400000);
});
const canReportNoReply = computed(() => noReplyEligible.value && report.value?.status !== "removed");

const dialogOpen = ref(false);
const reason = ref<ReportReason>();
const busy = ref(false);
const error = ref("");

function openDialog() {
  error.value = "";
  reason.value = undefined;
  dialogOpen.value = true;
  trackEvent("job_report_started", { surface: "app_page" });
}

async function submit(chosen: ReportReason, from: "dialog" | "prompt") {
  busy.value = true;
  error.value = "";
  try {
    await httpsCallable(functions, "reportJob")({ applicationId: job.id, reason: chosen });
    trackEvent("job_report_submitted", { reason: chosen, surface: from === "prompt" ? "no_reply_prompt" : "app_page" });
    dialogOpen.value = false;
  } catch (caught) {
    const failure = caught as { message?: string; details?: { block?: string } };
    error.value = failure.message || "That didn't go through. Try again.";
    trackEvent("job_report_blocked", { cause: failure.details?.block ?? "error" });
  } finally {
    busy.value = false;
  }
}

async function withdraw() {
  const withdrawn = ownReport.value?.reason;
  busy.value = true;
  error.value = "";
  try {
    await httpsCallable(functions, "withdrawJobReport")({ keyHash: job.jobKeyHash });
    if (withdrawn) trackEvent("job_report_withdrawn", { reason: withdrawn });
  } catch {
    error.value = "That didn't go through. Try again.";
  } finally {
    busy.value = false;
  }
}
</script>
