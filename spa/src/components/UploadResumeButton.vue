<template>
  <Button :disabled="isUploading" @click="openFileDialog">
    <PhSpinner v-if="isUploading" class="animate-spin" />
    <PhFileArrowUp v-else />
    <slot><span>Upload<span class="hidden lg:inline"> resume</span></span></slot>
  </Button>
</template>

<script setup lang="ts">
import { PhFileArrowUp, PhSpinner } from "@phosphor-icons/vue";
import { Button } from "@/components/ui/button";
import { useResumeUpload } from "@/composables/useResumeUpload";

const { isUploading, openFileDialog } = useResumeUpload();
</script>
