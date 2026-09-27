<!-- "Report a wrong change" for one row of the tailored version's change
     list. A report is how we learn the checks missed something. -->
<template>
  <form class="flex flex-col gap-3 rounded-card bg-muted p-3" @submit.prevent="send">
    <ChoicePills v-model="reason" label="What's wrong" :options="REASONS" :disabled="isSending" />
    <Textarea
      v-model="note"
      :disabled="isSending"
      maxlength="1000"
      rows="2"
      placeholder="Optional: what does it get wrong?"
      aria-label="What does it get wrong?"
    />
    <p class="text-[13px] text-muted-foreground">
      Sends this change (before and after) to us so we can fix the check. The change is switched off.
    </p>
    <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>
    <div class="flex gap-2">
      <Button type="submit" size="sm" :disabled="isSending">
        <Spinner v-if="isSending" />
        Send report
      </Button>
      <Button type="button" size="sm" variant="ghost" :disabled="isSending" @click="emit('cancel')">Cancel</Button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useCurrentUser } from "vuefire";
import ChoicePills from "@/components/ai/ChoicePills.vue";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/firebase/config";
import { trackEvent } from "@/analytics";
import type { ChangeRow } from "@/lib/tailoredResume";

export type ReportReason = "not_true" | "worse" | "other";

type TailoredChangeReportProps = {
  tailoredResumeId: string;
  row: ChangeRow;
};

type TailoredChangeReportEmits = {
  (event: "reported"): void;
  (event: "cancel"): void;
};

const { tailoredResumeId, row } = defineProps<TailoredChangeReportProps>();
const emit = defineEmits<TailoredChangeReportEmits>();

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "not_true", label: "Not true" },
  { value: "worse", label: "Worse" },
  { value: "other", label: "Other" },
];

const user = useCurrentUser();
const reason = ref<ReportReason>("not_true");
const note = ref("");
const isSending = ref(false);
const errorMessage = ref("");

async function send() {
  if (!user.value) return;
  isSending.value = true;
  errorMessage.value = "";
  try {
    await addDoc(collection(db, "tailoredResumeReports"), {
      userId: user.value.uid,
      tailoredResumeId,
      opIndex: row.index,
      kind: row.kind,
      reason: reason.value,
      note: note.value.trim().slice(0, 1000),
      before: row.before.slice(0, 2000),
      after: row.after.slice(0, 2000),
      requirement: row.requirement.slice(0, 500),
      createdAt: serverTimestamp(),
    });
    trackEvent("tailored_resume_change_reported", { kind: row.kind, reason: reason.value });
    emit("reported");
  } catch {
    errorMessage.value = "The report didn't send. Try again in a moment.";
  } finally {
    isSending.value = false;
  }
}
</script>
