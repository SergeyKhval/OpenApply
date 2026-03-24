<template>
  <div class="container mx-auto max-w-2xl py-8 px-4">
    <PageHeader title="New Job Application" />

    <!-- Loading: parsing in progress -->
    <div v-if="isParsingInProgress" class="flex flex-col items-center gap-4 py-16">
      <PhSpinner size="64" class="animate-spin text-primary" />
      <MessageRotator />
    </div>

    <!-- Form ready -->
    <template v-else>
      <p class="text-muted-foreground mb-6">
        {{ parsingFailed ? "This job page didn't make it easy for us. Fill in the details below and you're good to go." : "We extracted the details below. Review and save to start tracking this application." }}
      </p>

      <Alert v-if="parsingFailed" variant="destructive" class="mb-6">
        <PhWarningCircle />
        <AlertDescription>
          {{ errorMessage || "Looks like this job listing was built to keep robots out. The details couldn't be extracted automatically." }}
        </AlertDescription>
      </Alert>

      <JobApplicationForm
        variant="page"
        :company-name="parsedData?.companyName || ''"
        :position="parsedData?.position || ''"
        :remote-policy="computedRemotePolicy"
        :employment-type="computedEmploymentType"
        :technologies="parsedData?.technologies || []"
        :company-logo-url="parsedData?.companyLogoUrl || ''"
        :job-description-link="jobSnapshot?.jobDescriptionLink || ''"
        :job-description="parsedData?.description || ''"
        :job-id="jobId || ''"
        :parsing-failed="parsingFailed"
        :analytics-source="fromLp ? 'landing_page_parse' : undefined"
        @saved="onSaved"
        @back="router.push('/dashboard/applications')"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useDocument } from "vuefire";
import { doc, collection } from "firebase/firestore";
import { PhSpinner, PhWarningCircle } from "@phosphor-icons/vue";
import { db } from "@/firebase/config";
import JobApplicationForm from "@/components/JobApplicationForm.vue";
import PageHeader from "@/components/PageHeader.vue";
import MessageRotator from "@/components/MessageRotator.vue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { isValidJobId, isJobParsing, isJobParseFailed } from "@/composables/useJobIngestion";
import type { JobSnapshot } from "@/composables/useJobIngestion";

const route = useRoute();
const router = useRouter();

const fromLp = computed(() => route.query.from === "lp");

const jobId = computed(() => {
  const job = route.query.job;
  return isValidJobId(job) ? job : null;
});

const documentRef = computed(() =>
  jobId.value ? doc(collection(db, "jobs"), jobId.value) : null,
);

const jobSnapshot = useDocument<JobSnapshot>(documentRef);

const parsedData = computed(() => jobSnapshot.value?.parsedData ?? null);

const isParsingInProgress = computed(() => isJobParsing(jobSnapshot.value, jobId.value));

const parsingFailed = computed(() => isJobParseFailed(jobSnapshot.value));

const errorMessage = computed(() => jobSnapshot.value?.errorMessage ?? null);

const computedRemotePolicy = computed<"remote" | "in-office" | "hybrid" | undefined>(() => {
  const value = parsedData.value?.remotePolicy;
  return value === "remote" || value === "in-office" || value === "hybrid" ? value : undefined;
});

const computedEmploymentType = computed<"full-time" | "part-time" | undefined>(() => {
  const value = parsedData.value?.employmentType;
  return value === "full-time" || value === "part-time" ? value : undefined;
});

async function onSaved(applicationId: string) {
  await router.push(`/dashboard/applications/${applicationId}`);
}
</script>

<route lang="yaml">
meta:
  requiresAuth: true
</route>
