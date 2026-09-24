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
        class="hidden md:flex md:w-1/2 bg-gradient-to-br from-primary/10 via-background to-primary/5 items-center justify-center p-12"
      >
        <!-- Variant A: Value pitch (no pending job) -->
        <div v-if="!hasPendingJob && !pendingToolApplication" class="max-w-md space-y-8">
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

        <!-- Variant C: Job saved from the landing page match tool or the browser extension -->
        <div v-else-if="pendingToolApplication" class="max-w-md space-y-6 text-center">
          <PhCheckCircle :size="48" weight="fill" class="text-primary mx-auto" />
          <h2 class="text-2xl font-bold text-foreground">
            Sign up and this job is saved to your tracker
          </h2>
          <div class="rounded-lg border border-border bg-card p-4 text-left flex items-center gap-4">
            <ResumeScore
              v-if="pendingToolApplication.match"
              class="size-14 shrink-0"
              :score="pendingToolApplication.match.matchScore"
            />
            <div class="min-w-0">
              <p class="font-medium text-foreground truncate">
                {{ pendingToolApplication.position || "Your job" }}
              </p>
              <p v-if="pendingToolApplication.companyName" class="text-sm text-muted-foreground truncate">
                {{ pendingToolApplication.companyName }}
              </p>
            </div>
          </div>
          <p class="text-muted-foreground">
            <template v-if="pendingToolApplication.match">Your match check comes with it.</template>
            Track status, interviews, and follow-ups for free.
          </p>
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
              Analyzing your job listing…
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
              This job page played hard to get
            </h2>
            <p class="text-muted-foreground">
              Whoever built it really didn't want us reading it. Sign up and we'll let you fill in the details
            </p>
          </template>
        </div>
      </div>

      <!-- Mobile banner for a job saved from the match tool -->
      <div
        v-if="pendingToolApplication && !hasPendingJob"
        class="md:hidden flex items-center gap-3 px-4 py-3 bg-primary/10 border-b border-primary/20"
      >
        <PhCheckCircle class="text-primary shrink-0" :size="20" />
        <p class="text-sm text-foreground">
          Sign up and {{ pendingToolApplication.position || "this job" }} is saved{{
            pendingToolApplication.match ? " with your match check" : " to your tracker"
          }}.
        </p>
      </div>

      <!-- Mobile banner for pending job (visible only on mobile) -->
      <div
        v-if="hasPendingJob"
        class="md:hidden flex items-center gap-3 px-4 py-3 bg-primary/10 border-b border-primary/20"
      >
        <template v-if="isParsing">
          <div
            class="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0"
            aria-hidden="true"
          />
          <p class="text-sm text-foreground">
            Analyzing your job listing… Sign up to save results.
          </p>
        </template>
        <template v-else-if="isParsed">
          <PhCheckCircle class="text-primary shrink-0" :size="20" />
          <p class="text-sm text-foreground">
            Job details ready! Sign up to save.
          </p>
        </template>
        <template v-else>
          <p class="text-sm text-foreground">
            Sign up to save this job application.
          </p>
        </template>
      </div>

      <!-- RIGHT PANEL: auth form -->
      <div class="w-full md:w-1/2 flex flex-col items-center justify-center gap-4 p-8">
        <a href="/" class="md:hidden flex flex-col items-center gap-1 mb-2 text-center">
          <span class="text-2xl font-bold text-foreground">OpenApply</span>
          <span class="text-sm text-muted-foreground">Track every job application. Free.</span>
        </a>
        <SignInForm
          v-if="viewMode === 'sign-in'"
          :pending-job="hasPendingJob || !!pendingToolApplication"
          :source="source"
          @sign-up="viewMode = 'sign-up'"
        />
        <SignUpForm
          v-else
          :pending-job="hasPendingJob || !!pendingToolApplication"
          :source="source"
          @sign-in="viewMode = 'sign-in'"
        />
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
import ResumeScore from "@/components/ResumeScore.vue";
import { isJobParsing, isJobParseFailed } from "@/composables/useJobIngestion";
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
