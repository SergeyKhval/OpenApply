<template>
  <div class="flex h-screen bg-background">
    <div class="hidden w-64 bg-sidebar border-r border-sidebar-border lg:block">
      <AppNavigation />
    </div>

    <div class="flex-1 overflow-auto translate-z-0">
      <RouterView v-slot="{ Component }">
        <KeepAlive include="index">
          <Component :is="Component" />
        </KeepAlive>
      </RouterView>
    </div>
  </div>

  <Sheet
    :open="drawerNavigationStore.isOpen"
    @update:open="drawerNavigationStore.update"
  >
    <SheetContent side="left">
      <AppNavigation @close-nav="drawerNavigationStore.close" />
    </SheetContent>
  </Sheet>
</template>

<script setup lang="ts">
import { useDrawerNavigationStore } from "@/stores/drawerNavigationStore.ts";
import AppNavigation from "@/components/AppNavigation.vue";
import { Sheet, SheetContent } from "@/components/ui/sheet";

const drawerNavigationStore = useDrawerNavigationStore();
</script>

<route lang="yaml">
meta:
  requiresAuth: true
</route>
