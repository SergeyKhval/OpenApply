<!-- Tangerine check mark + wordmark, as on the landing (astro Logo.astro).
     Signed in it goes to Jobs; the sign-in page passes href="/" (the landing). -->
<template>
  <component
    :is="href ? 'a' : RouterLink"
    v-bind="href ? { href } : { to: '/jobs' }"
    :aria-label="href ? 'OpenApply home' : 'OpenApply, jobs'"
    class="flex items-center gap-[9px]"
  >
    <span class="grid size-[30px] shrink-0 place-items-center rounded-[10px_10px_10px_3px] bg-primary text-primary-foreground">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </span>
    <span class="font-display text-[21px] font-extrabold tracking-[-0.02em] text-foreground">OpenApply</span>
  </component>
</template>

<script setup lang="ts">
import { RouterLink } from "vue-router";

const { href } = defineProps<{ href?: string }>();
</script>
