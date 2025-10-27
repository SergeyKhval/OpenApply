<template>
  <div
    class="flex shrink-0 h-20 items-center mb-6 px-3 lg:px-6 py-5 gap-2 lg:gap-12 sticky top-0 bg-background z-10 border-b border-sidebar-border"
  >
    <Button variant="ghost" class="lg:hidden" @click="openDrawer">
      <PhList />
    </Button>

    <slot />
  </div>
</template>
<script setup lang="ts">
import { PhList } from "@phosphor-icons/vue";
import { useDrawerNavigationStore } from "@/stores/drawerNavigationStore.ts";
import { Button } from "@/components/ui/button";

const { open: openDrawer } = useDrawerNavigationStore();
</script>
