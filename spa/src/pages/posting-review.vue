<!-- Public: an employer (or anyone) asks us to review the signals shown on a posting. No account needed. -->
<template>
  <div class="min-h-screen bg-background px-4 py-10">
    <main class="mx-auto flex max-w-xl flex-col gap-6">
      <a href="/" class="font-display text-xl font-extrabold text-foreground">OpenApply</a>
      <div class="flex flex-col gap-2">
        <h1 class="text-3xl font-extrabold">Ask for a review of a posting</h1>
        <p class="text-soft-foreground">
          OpenApply shows job seekers dated facts about a posting and, once three people make the same one, reports from
          people who saved it. If something shown about your posting is wrong, tell us.
        </p>
      </div>

      <Card v-if="lines.length" class="gap-3">
        <CardHeader><CardTitle class="text-base">Shown on this posting now</CardTitle></CardHeader>
        <CardContent>
          <ul class="flex flex-col gap-2 text-sm">
            <li v-for="line in lines" :key="line.type">
              <span class="font-semibold">{{ line.text }}</span>
              <span class="text-muted-foreground"> · {{ line.source }}</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Alert v-if="!validJob">
        <AlertDescription>This link doesn't point to a posting. Open it again from the posting's signals.</AlertDescription>
      </Alert>

      <Card v-else-if="sent">
        <CardContent class="flex flex-col gap-2">
          <p class="font-semibold">Thanks, we have your request.</p>
          <p class="text-soft-foreground">
            Reports from people are hidden on this posting while we look. We'll reply to {{ email }} within 7 days with our
            decision and the reasons for it.
          </p>
        </CardContent>
      </Card>

      <form v-else class="flex flex-col gap-4" @submit.prevent="submit">
        <div class="flex flex-col gap-1.5">
          <Label for="review-email">Your email</Label>
          <Input id="review-email" v-model="email" type="email" autocomplete="email" required maxlength="200" />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="review-message">What's wrong</Label>
          <Textarea id="review-message" v-model="message" rows="6" required :maxlength="MAX_CHARS" />
          <span class="self-end text-[13px] text-muted-foreground">{{ message.length }} / {{ MAX_CHARS }}</span>
        </div>
        <p class="text-[13px] text-muted-foreground">
          While we review, reports from people are hidden on this posting. Facts read from the posting itself, like its
          posted date, stay. We reply within 7 days.
        </p>
        <p v-if="error" class="text-[13px] text-destructive" role="alert">{{ error }}</p>
        <Button type="submit" class="self-start" :disabled="busy">{{ busy ? "Sending…" : "Send request" }}</Button>
      </form>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { useDocument } from "vuefire";
import { doc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/firebase/config";
import { trackEvent } from "@/analytics";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { signLines, type JobSignalsDoc } from "@/lib/jobSignals";

const MAX_CHARS = 1000;

const route = useRoute();
const keyHash = computed(() => (typeof route.query.job === "string" ? route.query.job : ""));
const validJob = computed(() => /^[0-9a-f]{64}$/.test(keyHash.value));

const { data: signals } = useDocument<JobSignalsDoc>(
  computed(() => (validJob.value ? doc(db, "jobSignals", keyHash.value) : null)),
);
const lines = computed(() => signLines(signals.value, "the company", new Date()));

const email = ref("");
const message = ref("");
const busy = ref(false);
const sent = ref(false);
const error = ref("");

async function submit() {
  busy.value = true;
  error.value = "";
  try {
    await httpsCallable(functions, "submitSignalDispute")({
      keyHash: keyHash.value,
      email: email.value,
      message: message.value,
    });
    sent.value = true;
    trackEvent("signal_dispute_submitted");
  } catch (caught) {
    error.value = (caught as { message?: string }).message || "That didn't go through. Try again.";
  } finally {
    busy.value = false;
  }
}
</script>
