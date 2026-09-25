<!-- Tangerine check mark + wordmark, as on the landing (astro Logo.astro) -->
<template>
  <RouterLink to="/jobs" aria-label="OpenApply, jobs" class="flex items-center gap-[9px]">
    <span class="grid size-[30px] shrink-0 place-items-center rounded-[10px_10px_10px_3px] bg-primary text-primary-foreground">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </span>
    <span class="font-display text-[21px] font-extrabold tracking-[-0.02em] text-foreground">OpenApply</span>
  </RouterLink>
</template>
