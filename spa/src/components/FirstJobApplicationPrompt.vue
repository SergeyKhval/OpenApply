<template>
  <div
    class="mx-auto flex w-full max-w-xl flex-col items-center gap-6 rounded-xl border border-dashed border-border px-6 py-12 text-center"
  >
    <span
      class="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"
    >
      <PhLink :size="24" weight="bold" />
    </span>
    <div class="space-y-2">
      <h3 class="text-xl font-semibold text-foreground">
        Track your first job
      </h3>
      <p class="text-sm text-muted-foreground">
        Paste a link to any job posting. We'll fill in the company, role, and
        details for you.
      </p>
    </div>

    <form
      class="flex w-full flex-col gap-2 sm:flex-row"
      novalidate
      @submit.prevent="handleSubmit"
    >
      <Input
        v-model="jobDescriptionLink"
        type="url"
        inputmode="url"
        :autofocus="shouldAutofocus"
        aria-label="Job posting link"
        :aria-invalid="showError"
        aria-describedby="job-link-error"
        placeholder="https://jobs.example.com/senior-engineer…"
        :class="['sm:flex-1', showError && 'border-destructive']"
      />
      <Button type="submit">
        <PhSparkle />
        Add job
      </Button>
    </form>
    <p v-if="showError" id="job-link-error" role="alert" class="-mt-4 text-xs text-destructive">
      Paste a full link, starting with https://
    </p>

    <p class="text-sm text-muted-foreground">
      No link?
      <button
        type="button"
        class="cursor-pointer text-primary hover:underline"
        @click="openAddDialog({ 'add-mode': 'manual' })"
      >
        Enter details manually
      </button>
      or
      <RouterLink to="/dashboard/file-import" class="text-primary hover:underline">
        import a spreadsheet
      </RouterLink>
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { PhLink, PhSparkle } from "@phosphor-icons/vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const router = useRouter();
const route = useRoute();

const jobDescriptionLink = ref("");
const submitted = ref(false);

// Autofocus is desktop-only: on mobile it pops the keyboard open over the
// explanation before the user has read it.
const shouldAutofocus =
  typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;

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
