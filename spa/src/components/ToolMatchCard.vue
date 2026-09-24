<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center justify-between gap-2">
        Resume match check
        <span class="text-xs font-normal text-muted-foreground">{{ checkedOn }}</span>
      </CardTitle>
    </CardHeader>

    <CardContent class="flex flex-col gap-5">
      <Alert v-if="justSaved">
        <PhCheckCircle class="text-emerald-500" />
        <AlertDescription class="flex items-center justify-between gap-3 flex-wrap">
          <p>Saved from your match check. This application is a draft for now.</p>
          <Button
            v-if="!markedApplied"
            size="sm"
            variant="outline"
            class="shrink-0"
            @click="handleMarkApplied"
          >
            I applied
          </Button>
          <span v-else class="text-sm text-emerald-600 font-medium shrink-0">Marked as Applied ✓</span>
        </AlertDescription>
      </Alert>

      <div class="flex items-center gap-4">
        <ResumeScore class="size-20 shrink-0" :score="match.matchScore" />
        <p class="text-sm text-muted-foreground">{{ match.verdict }}</p>
      </div>

      <button
        v-if="!expanded"
        type="button"
        class="lg:hidden text-sm text-primary hover:underline text-left -mt-3"
        @click="expanded = true"
      >
        See details
      </button>

      <template v-if="expanded">
        <div v-if="match.requirements.length">
          <h4 class="text-sm font-semibold mb-2">Requirements</h4>
          <ul class="flex flex-col divide-y divide-border">
            <li
              v-for="requirement in match.requirements"
              :key="requirement.requirement"
              class="flex gap-2 py-2 text-sm"
            >
              <PhCheckCircle
                v-if="requirement.status === 'matched'"
                class="text-emerald-500 shrink-0 mt-0.5"
                :size="16"
              />
              <PhCircleHalf
                v-else-if="requirement.status === 'partial'"
                class="text-amber-500 shrink-0 mt-0.5"
                :size="16"
              />
              <PhXCircle v-else class="text-destructive shrink-0 mt-0.5" :size="16" />
              <div class="min-w-0">
                <p>
                  {{ requirement.requirement }}
                  <Badge v-if="requirement.importance === 'must-have'" variant="outline" class="ml-1 text-[10px]">
                    must-have
                  </Badge>
                </p>
                <p v-if="requirement.evidence" class="text-xs italic text-muted-foreground mt-0.5">
                  “{{ requirement.evidence }}”
                </p>
              </div>
            </li>
          </ul>
        </div>

        <div v-if="match.fixes.length">
          <h4 class="text-sm font-semibold mb-2">Where to close the gaps</h4>
          <ol class="list-decimal pl-5 flex flex-col gap-2 text-sm">
            <li v-for="(fix, index) in match.fixes" :key="index">
              <span class="font-medium">{{ fix.gap }}</span>
              <span class="text-muted-foreground"> {{ fix.action }}</span>
            </li>
          </ol>
        </div>

        <div v-if="match.missingKeywords.length" class="flex flex-wrap gap-1">
          <Badge
            v-for="missingKeyword in match.missingKeywords"
            :key="missingKeyword"
            variant="outline"
          >
            {{ missingKeyword }}
          </Badge>
        </div>
      </template>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { PhCheckCircle, PhCircleHalf, PhXCircle } from "@phosphor-icons/vue";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ResumeScore from "@/components/ResumeScore.vue";
import type { ToolMatch } from "@/types";

type ToolMatchCardProps = {
  match: ToolMatch;
  justSaved?: boolean;
};

type ToolMatchCardEmits = {
  (event: "mark-applied"): void;
};

const { match, justSaved = false } = defineProps<ToolMatchCardProps>();
const emit = defineEmits<ToolMatchCardEmits>();

const checkedOn = computed(() => {
  const date = new Date(match.checkedAt);
  return Number.isNaN(date.getTime())
    ? ""
    : `Checked ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
});

// Full details by default on desktop (matches the `lg` grid breakpoint this
// card sits above); collapsed to score + verdict on mobile.
const expanded = ref(
  typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : true,
);

const markedApplied = ref(false);
function handleMarkApplied() {
  markedApplied.value = true;
  emit("mark-applied");
}
</script>
