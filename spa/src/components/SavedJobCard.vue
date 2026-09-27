<!-- Sign-in page: the job waiting to be saved (from the match tool, the
     extension or a pasted link), as on the canvas "Sign up" board. `compact`
     is the phone version above the form. -->
<template>
  <div
    v-if="compact"
    class="flex items-center gap-3 rounded-card bg-muted px-3.5 py-3"
  >
    <CompanyAvatar :company-name="companyName || position" class="size-10 shrink-0 text-sm" />
    <div class="flex min-w-0 flex-col">
      <span class="text-[13px] text-soft-foreground">Your saved job</span>
      <span class="truncate text-[15px] font-bold">{{ position || "Your job" }}</span>
      <span class="truncate text-[13px] text-soft-foreground">
        {{ [companyName, matchScore !== undefined ? `Match ${matchScore}` : ""].filter(Boolean).join(" · ") }}
      </span>
    </div>
  </div>

  <div v-else class="flex flex-col gap-3">
    <span class="text-sm font-semibold text-soft-foreground">Your saved job</span>
    <div class="flex flex-col gap-3 rounded-card bg-card p-5 shadow-card dark:border dark:border-border">
      <div class="flex items-center gap-3">
        <CompanyAvatar :company-name="companyName || position" class="size-11 shrink-0 text-sm" />
        <div class="flex min-w-0 flex-col">
          <span class="truncate text-[15px] font-bold">{{ position || "Your job" }}</span>
          <span v-if="subtitle" class="truncate text-sm text-soft-foreground">{{ subtitle }}</span>
        </div>
      </div>
      <div v-if="matchScore !== undefined" class="flex items-center gap-2.5">
        <span class="rounded-full bg-success-soft px-2.5 py-0.5 text-[13px] font-semibold text-success">Match {{ matchScore }}</span>
        <span v-if="matchLine" class="text-[13px] text-soft-foreground">{{ matchLine }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import CompanyAvatar from "@/components/jobs/CompanyAvatar.vue";

const {
  position,
  companyName = "",
  location = "",
  matchScore,
  requirements = [],
  compact = false,
} = defineProps<{
  position: string;
  companyName?: string;
  location?: string;
  matchScore?: number;
  requirements?: { status: string; importance: string }[];
  compact?: boolean;
}>();

const subtitle = computed(() => [companyName, location].filter(Boolean).join(" · "));

// "4 of 6 must-haves met", from the match tool's requirements
const matchLine = computed(() => {
  const mustHaves = requirements.filter((requirement) => requirement.importance === "must-have");
  if (!mustHaves.length) return "";
  const met = mustHaves.filter((requirement) => requirement.status === "matched").length;
  return `${met} of ${mustHaves.length} must-haves met`;
});
</script>
