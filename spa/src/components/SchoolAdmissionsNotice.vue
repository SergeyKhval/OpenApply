<template>
  <p
    class="max-w-md w-full rounded-md border border-border bg-muted/40 px-3 py-2 text-center text-xs text-muted-foreground"
  >
    OpenApply is a job search tracker. Looking for OpenApply school admissions?
    <a
      :href="FARIA_OPENAPPLY_URL"
      class="font-medium text-foreground underline underline-offset-2 hover:text-primary"
      @click="trackEvent('school_admissions_redirect_clicked', { location: 'sign_in' })"
    >
      Go to Faria's OpenApply
    </a>
  </p>
</template>

<script setup lang="ts">
import { trackEvent } from "@/analytics";
import { FARIA_OPENAPPLY_URL } from "@/constants/externalLinks";
</script>
