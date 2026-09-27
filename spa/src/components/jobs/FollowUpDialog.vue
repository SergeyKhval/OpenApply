<!-- A ready-to-send message (follow-up, thank-you, or offer reply) to copy into email or LinkedIn -->
<template>
  <Dialog :open="!!job" @update:open="(open) => !open && emit('close')">
    <DialogContent class="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{{ dialogTitle }}</DialogTitle>
        <DialogDescription>Edit it if you like, then copy it into an email or a LinkedIn message.</DialogDescription>
      </DialogHeader>
      <Label for="follow-up-message" class="sr-only">Message</Label>
      <Textarea id="follow-up-message" v-model="message" rows="9" />
      <DialogFooter class="gap-2 sm:justify-start">
        <Button @click="copy">
          <PhCheck v-if="copied" />
          <PhCopy v-else />
          {{ copied ? "Copied" : "Copy message" }}
        </Button>
        <Button variant="ghost" as-child>
          <a :href="mailto">Open in email</a>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { PhCheck, PhCopy } from "@phosphor-icons/vue";
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
import { Textarea } from "@/components/ui/textarea";
import { toJsDate } from "@/lib/jobDates";
import { trackEvent } from "@/analytics";
import type { FollowUpTemplateType, JobApplication } from "@/types";

const {
  job,
  type = "follow_up",
  contactName,
} = defineProps<{ job: JobApplication | null; type?: FollowUpTemplateType; contactName?: string }>();
const emit = defineEmits<{ (event: "close"): void }>();

const message = ref("");
const copied = ref(false);

const DIALOG_TITLES: Record<FollowUpTemplateType, (companyName: string) => string> = {
  follow_up: (companyName) => `Follow up with ${companyName}`,
  thank_you: (companyName) => `Thank ${companyName} for the interview`,
  offer_response: (companyName) => `Respond to the offer from ${companyName}`,
};

const MAILTO_SUBJECTS: Record<FollowUpTemplateType, (position: string) => string> = {
  follow_up: (position) => `Following up: ${position}`,
  thank_you: (position) => `Thank you: ${position}`,
  offer_response: (position) => `Re: offer for ${position}`,
};

const dialogTitle = computed(() => (job ? DIALOG_TITLES[type](job.companyName) : ""));

function buildMessage(current: JobApplication): string {
  const greeting = contactName ? `Hi ${contactName},` : "Hi,";

  if (type === "thank_you") {
    return `${greeting}

Thank you for taking the time to talk with me about the ${current.position} role at ${current.companyName}. I enjoyed the conversation and I'm even more interested in the role.

Please let me know if there's anything else I can share to help with your decision.

Best,`;
  }

  if (type === "offer_response") {
    return `${greeting}

Thank you again for the offer for the ${current.position} role at ${current.companyName}. I'm excited about it and want to give it the consideration it deserves.

Could you let me know the timeline for a decision, and whether there's some flexibility on it? I'd appreciate a bit more time before I answer.

Thank you,`;
  }

  const appliedAt = toJsDate(current.appliedAt);
  const when = appliedAt
    ? ` on ${appliedAt.toLocaleDateString(undefined, { day: "numeric", month: "long" })}`
    : "";
  return `Hi,

I applied for the ${current.position} role at ${current.companyName}${when} and wanted to check in. I'm still very interested and would be glad to share anything else that helps.

Is there an update on the next steps?

Thank you,`;
}

watch(
  [() => job, () => type, () => contactName],
  ([current]) => {
    copied.value = false;
    if (!current) return;
    message.value = buildMessage(current);
  },
  { immediate: true },
);

const mailto = computed(
  () =>
    `mailto:?subject=${encodeURIComponent(job ? MAILTO_SUBJECTS[type](job.position) : "")}&body=${encodeURIComponent(message.value)}`,
);

async function copy() {
  try {
    await navigator.clipboard.writeText(message.value);
    copied.value = true;
    trackEvent("follow_up_copied", { applicationId: job?.id, template: type });
  } catch {
    copied.value = false;
  }
}
</script>
