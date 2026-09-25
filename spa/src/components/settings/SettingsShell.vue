<!-- Settings pages: one title, a section list on the left (a row of pills on
     phones), the section on the right -->
<template>
  <div>
    <PageHeader>
      <h1 class="text-2xl font-extrabold lg:text-3xl">Settings</h1>
    </PageHeader>
    <div class="flex flex-col gap-6 px-4 pb-12 lg:flex-row lg:gap-10 lg:px-6">
      <nav aria-label="Settings" class="-mr-4 flex gap-1 overflow-x-auto pr-4 hide-scrollbar lg:mr-0 lg:w-56 lg:shrink-0 lg:flex-col lg:overflow-visible lg:pr-0">
        <RouterLink
          v-for="section in SECTIONS"
          :key="section.to"
          :to="section.to"
          class="flex h-11 shrink-0 items-center rounded-full px-4 text-[15px] font-medium whitespace-nowrap text-soft-foreground hover:bg-muted"
          active-class="bg-secondary !text-secondary-foreground font-semibold"
        >
          {{ section.label }}
        </RouterLink>
      </nav>
      <div class="flex min-w-0 max-w-3xl grow flex-col gap-5">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import PageHeader from "@/components/PageHeader.vue";

const SECTIONS = [
  { to: "/settings/import-export", label: "Import and export" },
  { to: "/settings/email", label: "Email" },
  { to: "/settings/appearance", label: "Appearance" },
];
</script>
