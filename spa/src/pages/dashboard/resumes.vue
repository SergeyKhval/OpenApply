<template>
  <div>
    <PageHeader>
      <h2 class="text-2xl font-semibold text-foreground whitespace-nowrap grow">
        Resumes
      </h2>
      <UploadResumeButton  />
    </PageHeader>

    <div class="px-6">
      <ResumesList />
    </div>
  </div>
</template>

<script setup lang="ts">
import PageHeader from "@/components/PageHeader.vue";
import ResumesList from "@/components/ResumesList.vue";
import UploadResumeButton from "@/components/UploadResumeButton.vue";
</script>

<route lang="yaml">
meta:
  requiresAuth: true
</route>
