<template>
  <Avatar :class="cn('size-9 rounded-full', props.class)">
    <AvatarImage v-if="logoUrl" :src="logoUrl" :alt="''" />
    <AvatarFallback
      class="rounded-full font-display text-[13px] font-bold text-foreground"
      :style="{ background: getCompanyAvatarColor(companyName) }"
    >
      {{ initials }}
    </AvatarFallback>
  </Avatar>
</template>

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getCompanyAvatarColor } from "@/lib/companyAvatarColor";
import { cn } from "@/lib/utils";

const props = defineProps<{
  companyName: string;
  logoUrl?: string;
  class?: HTMLAttributes["class"];
}>();

// "Cedar & Co" -> "CC": skip words that don't start with a letter or digit
const initials = computed(() => {
  const words = props.companyName.trim().split(/\s+/).filter((word) => /^[\p{L}\p{N}]/u.test(word));
  if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0] ?? props.companyName.trim()).slice(0, 2).toUpperCase();
});
</script>
