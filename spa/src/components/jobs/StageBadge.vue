<template>
  <span :class="cn(stageBadgeVariants({ stage }), props.class)">
    <span class="size-1.5 rounded-full" :class="DOT_CLASSES[stage]" aria-hidden="true" />
    <slot>{{ STAGE_LABELS[stage] }}</slot>
  </span>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { stageBadgeVariants } from "@/components/ui/badge";
import { STAGE_LABELS, type Stage } from "@/lib/stages";
import { cn } from "@/lib/utils";

const props = defineProps<{ stage: Stage; class?: HTMLAttributes["class"] }>();

const DOT_CLASSES: Record<Stage, string> = {
  saved: "bg-stage-saved",
  applied: "bg-stage-applied",
  interviewing: "bg-stage-interviewing",
  offer: "bg-stage-offer",
  closed: "bg-stage-closed",
};
</script>
