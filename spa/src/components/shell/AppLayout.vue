<!-- Signed-in layout shared by Jobs, Documents and Settings: sidebar on
     desktop, tab bar on phones, page content in the router view. -->
<template>
  <div class="flex h-dvh bg-background">
    <AppSidebar class="hidden lg:flex" />

    <div class="flex-1 overflow-auto translate-z-0 pb-[calc(4.5rem+max(0.5rem,env(safe-area-inset-bottom)))] lg:pb-0">
      <RouterView v-slot="{ Component }">
        <KeepAlive include="index">
          <Component :is="Component" />
        </KeepAlive>
      </RouterView>
    </div>

    <MobileTabBar />
  </div>
</template>

<script setup lang="ts">
import AppSidebar from "@/components/shell/AppSidebar.vue";
import MobileTabBar from "@/components/shell/MobileTabBar.vue";
</script>
