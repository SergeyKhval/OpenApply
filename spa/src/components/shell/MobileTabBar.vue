<!-- Phones and tablets (below lg): Jobs, Documents, Me -->
<template>
  <nav
    aria-label="Main"
    class="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-card px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden"
  >
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
        class="flex h-16 flex-1 flex-col items-center justify-center gap-[3px] text-xs"
        :class="link.active ? 'font-bold text-secondary-foreground' : 'font-medium text-muted-foreground'"
        @click="navigate"
      >
        <span class="grid h-[30px] w-14 place-items-center rounded-full" :class="{ 'bg-secondary': link.active }">
          <Component :is="link.icon" :size="21" :weight="link.active ? 'fill' : 'regular'" />
        </span>
        {{ link.label }}
      </a>
    </RouterLink>
  </nav>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { TAB_NAV, isNavActive } from "@/components/shell/mainNav";

const route = useRoute();
const links = computed(() => TAB_NAV.map((link) => ({ ...link, active: isNavActive(route.path, link.to) })));
</script>
