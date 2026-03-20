<template>
  <div class="min-h-screen bg-background flex">
    <!-- Loading state (full screen, centered) -->
    <div
      v-if="!userLoaded"
      class="flex flex-col items-center justify-center gap-4 w-full"
    >
      <div
        class="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin"
        aria-hidden="true"
      />
      <p class="text-lg font-semibold text-foreground">Loading...</p>
    </div>

    <!-- Unauthenticated: split layout -->
    <template v-else-if="!user">
      <!-- LEFT PANEL (desktop only, or mobile with pending job handled separately) -->
      <div
        class="hidden md:flex md:w-1/2 bg-gradient-to-br from-primary/10 via-background to-primary/5 items-center justify-center p-12"
      >
        <!-- Variant A: Value pitch (no pending job) -->
        <div v-if="!hasPendingJob" class="max-w-md space-y-8">
          <div class="space-y-3">
            <h1 class="text-3xl font-bold text-foreground">
              Your job search, organized
            </h1>
            <p class="text-lg text-muted-foreground">
              Stop losing track of where you applied.
            </p>
          </div>

          <div class="space-y-6">
            <div class="flex items-start gap-3">
              <PhCheckCircle
                :size="24"
                weight="fill"
                class="text-primary mt-0.5 shrink-0"
              />
              <div>
                <p class="font-medium text-foreground">
                  Paste a link, we do the rest
                </p>
                <p class="text-sm text-muted-foreground">
                  Company, role, and details extracted automatically
                </p>
              </div>
            </div>

            <div class="flex items-start gap-3">
              <PhCheckCircle
                :size="24"
                weight="fill"
                class="text-primary mt-0.5 shrink-0"
              />
              <div>
                <p class="font-medium text-foreground">AI resume reviews</p>
                <p class="text-sm text-muted-foreground">
                  See how your resume matches each job
                </p>
              </div>
            </div>

            <div class="flex items-start gap-3">
              <PhCheckCircle
                :size="24"
                weight="fill"
                class="text-primary mt-0.5 shrink-0"
              />
              <div>
                <p class="font-medium text-foreground">
                  Free to track, no subscription
                </p>
                <p class="text-sm text-muted-foreground">
                  Pay only for AI features, when you want them
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Variant B: Parsing status (with pending job) -->
        <div v-else class="max-w-md space-y-6 text-center">
          <!-- Loading / parsing -->
          <template v-if="isParsing">
            <div
              class="h-12 w-12 mx-auto rounded-full border-4 border-primary border-t-transparent animate-spin"
              aria-hidden="true"
            />
            <h2 class="text-2xl font-bold text-foreground">
              Analyzing your job listing...
            </h2>
            <p class="text-muted-foreground">
              We're extracting the company, role, and details. Sign up to save
              the results.
            </p>
          </template>

          <!-- Parsed -->
          <template v-else-if="isParsed">
            <PhCheckCircle
              :size="48"
              weight="fill"
              class="text-primary mx-auto"
            />
            <h2 class="text-2xl font-bold text-foreground">
              Ready! Sign up to save this job
            </h2>
            <div
              v-if="
                jobSnapshot?.parsedData?.companyName ||
                jobSnapshot?.parsedData?.position
              "
              class="rounded-lg border border-border bg-card p-4 text-left"
            >
              <p
                v-if="jobSnapshot?.parsedData?.companyName"
                class="font-medium text-foreground"
              >
                {{ jobSnapshot.parsedData.companyName }}
              </p>
              <p
                v-if="jobSnapshot?.parsedData?.position"
                class="text-sm text-muted-foreground"
              >
                {{ jobSnapshot.parsedData.position }}
              </p>
            </div>
          </template>

          <!-- Failed -->
          <template v-else-if="parseFailed">
            <h2 class="text-2xl font-bold text-foreground">
              We couldn't parse this job listing
            </h2>
            <p class="text-muted-foreground">
              Sign up and enter the details manually
            </p>
          </template>
        </div>
      </div>

      <!-- Mobile banner for pending job (visible only on mobile) -->
      <div
        v-if="hasPendingJob"
        class="md:hidden flex items-center gap-3 px-4 py-3 bg-primary/10 border-b border-primary/20"
      >
        <div
          class="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0"
          aria-hidden="true"
        />
        <p class="text-sm text-foreground">
          Analyzing your job listing... Sign up to save results.
        </p>
      </div>

      <!-- RIGHT PANEL: auth form -->
      <div class="w-full md:w-1/2 flex items-center justify-center p-8">
        <SignInForm
          v-if="viewMode === 'sign-in'"
          :pending-job="hasPendingJob"
          :source="source"
          @sign-up="viewMode = 'sign-up'"
        />
        <SignUpForm
          v-else
          :pending-job="hasPendingJob"
          :source="source"
          @sign-in="viewMode = 'sign-in'"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useCurrentUser, useIsCurrentUserLoaded, useDocument } from "vuefire";
import { doc, collection } from "firebase/firestore";
import { PhCheckCircle } from "@phosphor-icons/vue";
import { db } from "@/firebase/config";
import SignInForm from "@/components/SignInForm.vue";
import SignUpForm from "@/components/SignUpForm.vue";
import { usePostAuthRedirect } from "@/composables/usePostAuthRedirect";
import type { JobSnapshot } from "@/composables/useJobIngestion";

const user = useCurrentUser();
const userLoaded = useIsCurrentUserLoaded();
const { redirect, hasPendingJob, pendingJobId } = usePostAuthRedirect();
const viewMode = ref<"sign-in" | "sign-up">(hasPendingJob.value ? "sign-up" : "sign-in");

// Subscribe to job document when pending job exists
const jobDocRef = computed(() =>
  pendingJobId.value ? doc(collection(db, "jobs"), pendingJobId.value) : null,
);
const jobSnapshot = useDocument<JobSnapshot>(jobDocRef);

const isParsing = computed(() => {
  if (!pendingJobId.value) return false;
  if (jobSnapshot.value === undefined) return true;
  if (!jobSnapshot.value) return false;
  return ["pending", "scrapped", "parsing"].includes(jobSnapshot.value.status);
});

const isParsed = computed(
  () =>
    jobSnapshot.value?.status === "parsed" && !!jobSnapshot.value?.parsedData,
);

const parseFailed = computed(() => {
  if (!jobSnapshot.value) return false;
  return ["parse-failed", "failed"].includes(jobSnapshot.value.status);
});

const source = computed(() =>
  hasPendingJob.value ? ("landing_page_parse" as const) : ("direct" as const),
);

watch(user, (newUser) => {
  if (newUser) {
    redirect();
  }
});
</script>
