<!-- Admin: open "Ask for a review" requests on posting signals. Reads and writes go through admin-only callables. -->
<template>
  <Card>
    <CardHeader class="flex flex-row items-center justify-between gap-2">
      <CardTitle class="text-base">Posting reviews <span class="font-normal text-muted-foreground">{{ disputes.length }} open</span></CardTitle>
      <Button variant="outline" size="sm" :disabled="loading" @click="load">Refresh</Button>
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <p v-if="error" class="text-sm text-destructive" role="alert">{{ error }}</p>
      <p v-if="!loading && !disputes.length" class="text-sm text-muted-foreground">No open requests. Aim to answer each within 7 days.</p>
      <article
        v-for="dispute in disputes"
        :key="dispute.id"
        class="flex flex-col gap-3 rounded-xl border border-border p-4"
        :aria-label="`Review request from ${dispute.contactEmail}`"
      >
        <div class="flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <span class="font-semibold">{{ dispute.companyTitle ?? dispute.keyHash.slice(0, 12) }}</span>
          <span class="text-muted-foreground">{{ age(dispute.createdAt) }}</span>
        </div>
        <a v-if="dispute.link" :href="dispute.link" target="_blank" rel="noopener noreferrer nofollow" class="break-all text-sm text-secondary-foreground hover:underline">
          {{ dispute.link }}
        </a>
        <blockquote class="border-l-2 border-border pl-3 text-sm whitespace-pre-line">{{ dispute.message }}</blockquote>
        <p class="text-[13px] text-muted-foreground">
          From <a :href="`mailto:${dispute.contactEmail}`" class="hover:underline">{{ dispute.contactEmail }}</a>. Reply with the decision and the reasons.
        </p>

        <div class="flex flex-col gap-1 text-sm">
          <span class="font-semibold">
            Shown on the posting
            <span v-if="dispute.signals?.hidden" class="font-normal text-muted-foreground">(hidden by admin)</span>
            <span v-else-if="dispute.signals?.reportsHidden" class="font-normal text-muted-foreground">(reports hidden during review)</span>
          </span>
          <ul v-if="linesOf(dispute).length" class="flex flex-col gap-1">
            <li v-for="line in linesOf(dispute)" :key="line.type" :class="line.tone === 'red' ? 'text-destructive' : ''">
              {{ line.text }} <span class="text-muted-foreground">· {{ line.source }}</span>
            </li>
          </ul>
          <span v-else class="text-muted-foreground">Nothing</span>
        </div>

        <Label :for="`note-${dispute.id}`" class="sr-only">Note</Label>
        <Textarea :id="`note-${dispute.id}`" v-model="notes[dispute.id]" rows="2" placeholder="Decision and reasons (sent to them by you; kept here for the record)" />
        <div class="flex flex-wrap gap-2">
          <Button size="sm" :disabled="busy === dispute.id" @click="act(dispute.id, 'keep')">Keep reports</Button>
          <Button size="sm" variant="outline" :disabled="busy === dispute.id" @click="act(dispute.id, 'hide')">Hide posting signals</Button>
          <Button size="sm" variant="ghost" :disabled="busy === dispute.id || !notes[dispute.id]?.trim()" @click="act(dispute.id, 'resolve')">
            Resolve with note
          </Button>
        </div>
      </article>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { signLines, type JobSignalsDoc } from "@/lib/jobSignals";

type Dispute = {
  id: string;
  keyHash: string;
  contactEmail: string;
  message: string;
  createdAt: string | null;
  link: string | null;
  companyTitle: string | null;
  signals: (Required<Pick<JobSignalsDoc, "reportsHidden" | "hidden">> & Pick<JobSignalsDoc, "signs" | "reports">) | null;
};

const disputes = ref<Dispute[]>([]);
const notes = reactive<Record<string, string>>({});
const loading = ref(false);
const busy = ref<string | null>(null);
const error = ref("");

// What the posting shows once reports are back: the admin sees the hidden reports too
function linesOf(dispute: Dispute) {
  if (!dispute.signals) return [];
  return signLines({ signs: dispute.signals.signs, reports: dispute.signals.reports }, "the company", new Date());
}

function age(createdAt: string | null) {
  if (!createdAt) return "";
  const days = Math.floor((Date.now() - Date.parse(createdAt)) / 86400000);
  return days === 0 ? "today" : `${days} ${days === 1 ? "day" : "days"} ago${days >= 7 ? " · overdue" : ""}`;
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const { data } = await httpsCallable<void, { disputes: Dispute[] }>(functions, "listSignalDisputes")();
    disputes.value = data.disputes;
  } catch (caught) {
    error.value = (caught as Error).message;
  } finally {
    loading.value = false;
  }
}

async function act(disputeId: string, action: "keep" | "hide" | "resolve") {
  busy.value = disputeId;
  error.value = "";
  try {
    await httpsCallable(functions, "resolveSignalDispute")({ disputeId, action, note: notes[disputeId] ?? "" });
    disputes.value = disputes.value.filter((dispute) => dispute.id !== disputeId);
  } catch (caught) {
    error.value = (caught as Error).message;
  } finally {
    busy.value = null;
  }
}

onMounted(load);
</script>
