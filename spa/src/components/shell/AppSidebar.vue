<!-- Desktop sidebar (lg and up): logo, Jobs and Documents, AI checks left,
     account menu -->
<template>
  <aside class="flex h-full w-62 shrink-0 flex-col gap-1.5 border-r border-border bg-background px-4 pt-6 pb-3.5">
    <div class="px-2 pb-6"><AppLogo /></div>
    <nav aria-label="Main" class="flex flex-col gap-1">
      <RouterLink
        v-for="link in links"
        :key="link.to"
        v-slot="{ href, navigate }"
        :to="link.to"
        custom
      >
        <a
          :href="href"
          :aria-current="link.active ? 'page' : undefined"
          class="flex h-11 items-center gap-3 rounded-full px-4 text-[15px]"
          :class="link.active ? 'bg-secondary font-semibold text-secondary-foreground' : 'font-medium text-soft-foreground hover:bg-muted'"
          @click="navigate"
        >
          <Component :is="link.icon" :size="19" :weight="link.active ? 'fill' : 'regular'" />
          {{ link.label }}
          <span v-if="link.to === '/jobs' && activeJobs" class="ml-auto text-[13px] font-semibold">{{ activeJobs }}</span>
        </a>
      </RouterLink>
    </nav>
    <div class="grow" />
    <AllowanceMeter v-if="allowance" :allowance="allowance" class="mb-2" />
    <AccountMenu />
  </aside>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import AccountMenu from "@/components/shell/AccountMenu.vue";
import AllowanceMeter from "@/components/shell/AllowanceMeter.vue";
import AppLogo from "@/components/shell/AppLogo.vue";
import { MAIN_NAV, isNavActive } from "@/components/shell/mainNav";
import { useAiAllowance } from "@/composables/useAiAllowance";
import { useJobApplicationsData } from "@/composables/useJobApplicationsData";
import { stageOf } from "@/lib/stages";

const route = useRoute();
const links = computed(() => MAIN_NAV.map((link) => ({ ...link, active: isNavActive(route.path, link.to) })));
const { allowance } = useAiAllowance();
const { jobApplications } = useJobApplicationsData();

const activeJobs = computed(
  () => (jobApplications.value ?? []).filter((job) => stageOf(job.status) !== "closed").length,
);
</script>
