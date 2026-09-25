<!-- A ready-to-send follow-up message to copy into email or LinkedIn -->
<template>
  <Dialog :open="!!job" @update:open="(open) => !open && emit('close')">
    <DialogContent class="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>Follow up with {{ job?.companyName }}</DialogTitle>
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
import type { JobApplication } from "@/types";

const { job } = defineProps<{ job: JobApplication | null }>();
const emit = defineEmits<{ (event: "close"): void }>();

const message = ref("");
const copied = ref(false);

watch(
  () => job,
  (current) => {
    copied.value = false;
    if (!current) return;
    const appliedAt = toJsDate(current.appliedAt);
    const when = appliedAt
      ? ` on ${appliedAt.toLocaleDateString(undefined, { day: "numeric", month: "long" })}`
      : "";
    message.value = `Hi,

I applied for the ${current.position} role at ${current.companyName}${when} and wanted to check in. I'm still very interested and would be glad to share anything else that helps.

Is there an update on the next steps?

Thank you,`;
  },
  { immediate: true },
);

const mailto = computed(
  () =>
    `mailto:?subject=${encodeURIComponent(`Following up: ${job?.position ?? ""}`)}&body=${encodeURIComponent(message.value)}`,
);

async function copy() {
  try {
    await navigator.clipboard.writeText(message.value);
    copied.value = true;
    trackEvent("follow_up_copied", { applicationId: job?.id });
  } catch {
    copied.value = false;
  }
}
</script>
