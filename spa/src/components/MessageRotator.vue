<template>
  <p class="text-xl">
    {{ message }}
  </p>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useInterval } from "@vueuse/core";

const counter = useInterval(3000);

const statusMessages = [
  "Opening browser...",
  "Searching for job description...",
  "Analyzing job description...",
  "Extracting data...",
  "Proofreading...",
  "Finalizing...",
];
const message = computed(
  () => statusMessages[counter.value % statusMessages.length],
);
</script>
