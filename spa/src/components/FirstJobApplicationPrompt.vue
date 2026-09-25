<!-- First run: one action per browser. Desktop Chrome/Edge get the
     extension (once it has a store link, VITE_EXTENSION_URL); everyone else,
     or anyone who prefers, pastes a link. Owner: no import, no checklist. -->
<template>
  <div
    class="mx-auto flex w-full max-w-lg flex-col items-center gap-5 rounded-card bg-card px-6 py-10 text-center shadow-card dark:border dark:border-border sm:px-10"
  >
    <span class="grid size-14 place-items-center rounded-full bg-secondary text-secondary-foreground">
      <PhPuzzlePiece v-if="showExtension" :size="26" />
      <PhLink v-else :size="26" />
    </span>
    <div class="space-y-2">
      <h2 class="text-2xl font-extrabold text-foreground sm:text-3xl">Save your first job</h2>
      <p v-if="showExtension" class="text-[15px] text-soft-foreground">
        Add the extension, open any job posting, and click <b class="text-foreground">Save to OpenApply</b>. It reads the job from the page for you.
      </p>
      <p v-else class="text-[15px] text-soft-foreground">
        Paste the link to a job you're interested in. We'll fill in the company, role and details.
      </p>
    </div>

    <template v-if="showExtension">
      <Button size="lg" as-child>
        <a :href="extensionUrl" target="_blank" rel="noopener noreferrer" @click="trackExtensionClick">
          <PhGoogleChromeLogo />
          Add to Chrome, it's free
        </a>
      </Button>
      <button
        type="button"
        class="cursor-pointer text-[15px] font-semibold text-secondary-foreground hover:underline"
        @click="preferPaste = true"
      >
        or paste a link instead
      </button>
    </template>

    <template v-else>
      <form class="flex w-full flex-col gap-2 sm:flex-row" novalidate @submit.prevent="handleSubmit">
        <Input
          v-model="jobDescriptionLink"
          type="url"
          inputmode="url"
          :autofocus="shouldAutofocus"
          aria-label="Job posting link"
          :aria-invalid="showError"
          aria-describedby="job-link-error"
          placeholder="https://jobs.example.com/senior-engineer…"
          :class="['h-12 sm:flex-1', showError && 'border-destructive']"
        />
        <Button type="submit" size="lg" class="shrink-0">Save job</Button>
      </form>
      <p v-if="showError" id="job-link-error" role="alert" class="-mt-3 text-xs text-destructive">
        Paste a full link, starting with https://
      </p>
      <button
        type="button"
        class="cursor-pointer text-[15px] font-semibold text-secondary-foreground hover:underline"
        @click="openAddDialog({ 'add-mode': 'manual' })"
      >
        or add one by hand
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { PhGoogleChromeLogo, PhLink, PhPuzzlePiece } from "@phosphor-icons/vue";
import { isDesktopChromium } from "@/lib/browser";
import { trackEvent } from "@/analytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const {
  extensionUrl = import.meta.env.VITE_EXTENSION_URL,
  desktopChromium = isDesktopChromium(),
} = defineProps<{ extensionUrl?: string; desktopChromium?: boolean }>();

const router = useRouter();
const route = useRoute();

// Extension first only where it installs and once it has a store link
const preferPaste = ref(false);
const showExtension = computed(() => Boolean(extensionUrl) && desktopChromium && !preferPaste.value);

function trackExtensionClick() {
  trackEvent("extension_install_clicked", { from: "first_run" });
}

const jobDescriptionLink = ref("");
const submitted = ref(false);

// Autofocus is desktop-only: on mobile it pops the keyboard open over the
// explanation before the user has read it.
const shouldAutofocus =
  typeof window !== "undefined" && (window.matchMedia?.("(pointer: fine)").matches ?? false);

function isHttpUrl(value: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

// People paste links without a scheme ("linkedin.com/jobs/view/..."); treat
// that as https:// instead of showing an error.
function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

const showError = computed(
  () => submitted.value && !isHttpUrl(normalizeUrl(jobDescriptionLink.value)),
);

function openAddDialog(extraQuery: Record<string, string>) {
  router.replace({
    query: { ...route.query, "dialog-name": "add-job-application", ...extraQuery },
  });
}

function handleSubmit() {
  submitted.value = true;
  const link = normalizeUrl(jobDescriptionLink.value);
  if (!isHttpUrl(link)) return;

  openAddDialog({ "job-link": link });
  jobDescriptionLink.value = "";
  submitted.value = false;
}
</script>
