<template>
  <AppLayout />
</template>

<script setup lang="ts">
import AppLayout from "@/components/shell/AppLayout.vue";
</script>

<route lang="yaml">
meta:
  requiresAuth: true
</route>
