<template>
  <div class="min-h-screen bg-background flex flex-col md:flex-row">
    <!-- Loading state (full screen, centered) -->
    <div
      v-if="!userLoaded"
      class="flex flex-col items-center justify-center gap-4 w-full"
    >
      <div
        class="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin"
        aria-hidden="true"
      />
      <p class="text-lg font-semibold text-foreground">Loading…</p>
    </div>

    <!-- Unauthenticated: split layout -->
    <template v-else-if="!signedInUser">
      <!-- LEFT PANEL (desktop only, or mobile with pending job handled separately) -->
      <div
        class="relative hidden md:flex md:w-1/2 lg:w-[43%] bg-muted items-center justify-start p-12 lg:px-16"
      >
        <AppLogo href="/" class="absolute top-10 left-12 lg:left-16" />
        <!-- Variant A: Value pitch (no pending job) -->
        <div v-if="!hasPendingJob && !pendingToolApplication" class="max-w-md space-y-8">
          <div class="space-y-3">
            <h1 class="text-4xl font-extrabold text-foreground">
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
                  Paste a link or the description
                </p>
                <p class="text-sm text-muted-foreground">
                  Details fill in from public career pages
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
                  Free to track
                </p>
                <p class="text-sm text-muted-foreground">
                  Unlimited jobs, reminders and export
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Variant C: Job saved from the landing page match tool or the browser extension -->
        <div v-else-if="pendingToolApplication" class="flex w-full max-w-md flex-col gap-5">
          <SavedJobCard
            :position="pendingToolApplication.position"
            :company-name="pendingToolApplication.companyName"
            :location="pendingToolApplication.location"
            :match-score="pendingToolApplication.match?.matchScore"
            :requirements="pendingToolApplication.match?.requirements"
          />
          <p class="text-base text-soft-foreground">
            Create your account and we will add it to your tracker, with a reminder to follow up once you apply.
          </p>
        </div>

        <!-- Variant B: Parsing status (with pending job) -->
        <div v-else class="flex w-full max-w-md flex-col gap-5">
          <!-- Loading / parsing -->
          <template v-if="isParsing">
            <div
              class="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin"
              aria-hidden="true"
            />
            <h2 class="text-2xl font-bold text-foreground">
              Analyzing your job listing…
            </h2>
            <p class="text-muted-foreground">
              We're extracting the company, role, and details. Sign up to save
              the results.
            </p>
          </template>

          <!-- Parsed -->
          <template v-else-if="isParsed">
            <SavedJobCard
              v-if="jobSnapshot?.parsedData?.companyName || jobSnapshot?.parsedData?.position"
              :position="jobSnapshot?.parsedData?.position ?? ''"
              :company-name="jobSnapshot?.parsedData?.companyName ?? ''"
            />
            <p class="text-base text-soft-foreground">
              Create your account and we will add it to your tracker, with a reminder to follow up once you apply.
            </p>
          </template>

          <!-- Failed -->
          <template v-else-if="parseFailed && isPastedJob(jobSnapshot)">
            <h2 class="text-2xl font-bold text-foreground">
              Your description is saved
            </h2>
            <p class="text-muted-foreground">
              We couldn't spot the company or role in it. Sign up and fill those in
            </p>
          </template>
          <template v-else-if="parseFailed">
            <h2 class="text-2xl font-bold text-foreground">
              This job page played hard to get
            </h2>
            <p class="text-muted-foreground">
              Whoever built it really didn't want us reading it. Sign up and we'll let you fill in the details
            </p>
          </template>
        </div>
      </div>

      <!-- Phones: logo, then the saved job (if any) above the form -->
      <div class="flex flex-col gap-4 px-6 pt-6 md:hidden">
        <AppLogo href="/" />
        <SavedJobCard
          v-if="pendingToolApplication && !hasPendingJob"
          compact
          :position="pendingToolApplication.position"
          :company-name="pendingToolApplication.companyName"
          :match-score="pendingToolApplication.match?.matchScore"
        />
        <SavedJobCard
          v-else-if="isParsed && (jobSnapshot?.parsedData?.companyName || jobSnapshot?.parsedData?.position)"
          compact
          :position="jobSnapshot?.parsedData?.position ?? ''"
          :company-name="jobSnapshot?.parsedData?.companyName ?? ''"
        />
        <div v-else-if="hasPendingJob" class="flex items-center gap-3 rounded-card bg-muted px-3.5 py-3">
          <div
            v-if="isParsing"
            class="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0"
            aria-hidden="true"
          />
          <p class="text-sm text-foreground">
            {{ isParsing ? "Reading your job listing. Sign up to save it." : "Sign up to save this job." }}
          </p>
        </div>
      </div>

      <!-- RIGHT PANEL: auth form -->
      <div class="w-full md:w-1/2 lg:w-[57%] flex flex-col items-center justify-start gap-4 px-6 pt-5 pb-8 md:justify-center md:p-8">
        <!-- Google and the emailed code work the same for new and returning
             people; only the heading differs (?mode=signup, or a saved job) -->
        <SignInForm v-if="viewMode === 'sign-in'" :source="source" />
        <SignUpForm v-else :source="source" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useCurrentUser, useIsCurrentUserLoaded, useDocument } from "vuefire";
import { doc, collection } from "firebase/firestore";
import { PhCheckCircle } from "@phosphor-icons/vue";
import { db } from "@/firebase/config";
import SignInForm from "@/components/SignInForm.vue";
import SignUpForm from "@/components/SignUpForm.vue";
import { usePostAuthRedirect } from "@/composables/usePostAuthRedirect";
import {
  pendingApplicationSource,
  readPendingToolApplication,
} from "@/composables/pendingToolApplication";
import SavedJobCard from "@/components/SavedJobCard.vue";
import AppLogo from "@/components/shell/AppLogo.vue";
import { isJobParsing, isJobParseFailed, isPastedJob } from "@/composables/useJobIngestion";
import type { JobSnapshot } from "@/composables/useJobIngestion";
import { trackEvent } from "@/analytics";

const route = useRoute();
const router = useRouter();

const user = useCurrentUser();
const userLoaded = useIsCurrentUserLoaded();
// The landing page signs visitors in anonymously to call its tools; that
// session shares this origin but is not an account yet
const signedInUser = computed(() =>
  user.value && !user.value.isAnonymous ? user.value : null,
);
const { redirect, hasPendingJob, pendingJobId } = usePostAuthRedirect();
// Read once: the job the landing page match tool or the extension saved before signup
const pendingToolApplication = readPendingToolApplication();
const viewMode = ref<"sign-in" | "sign-up">(
  hasPendingJob.value || pendingToolApplication || route.query.mode === "signup"
    ? "sign-up"
    : "sign-in",
);

// Keep the URL in sync so the sign-in/sign-up toggle is deep-linkable
// (Header/hero "Get Started" links point here with ?mode=signup)
watch(viewMode, (mode) => {
  const query = { ...route.query };
  if (mode === "sign-up") {
    query.mode = "signup";
  } else {
    delete query.mode;
  }
  router.replace({ query });
});

// Subscribe to job document when pending job exists
const jobDocRef = computed(() =>
  pendingJobId.value ? doc(collection(db, "jobs"), pendingJobId.value) : null,
);
const jobSnapshot = useDocument<JobSnapshot>(jobDocRef);

const isParsing = computed(() => isJobParsing(jobSnapshot.value, pendingJobId.value));

const isParsed = computed(
  () =>
    jobSnapshot.value?.status === "parsed" && !isJobParseFailed(jobSnapshot.value),
);

const parseFailed = computed(() => isJobParseFailed(jobSnapshot.value));

const source = computed(() => {
  if (hasPendingJob.value) return "landing_page_parse" as const;
  if (pendingToolApplication) return pendingApplicationSource(pendingToolApplication);
  return "direct" as const;
});

watch(
  viewMode,
  (mode) => {
    if (mode === "sign-up") trackEvent("signup_view_shown", { source: source.value });
  },
  { immediate: true },
);

watch(
  signedInUser,
  (newUser) => {
    if (newUser) {
      redirect();
    }
  },
  { immediate: true },
);
</script>
