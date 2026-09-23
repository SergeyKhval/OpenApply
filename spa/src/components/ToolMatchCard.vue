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
        <AlertDescription>
          <p>
            Saved from your match check. This application is a draft for now. Mark it
            <strong>Applied</strong> above once you send it, and OpenApply will remind you to follow up.
          </p>
        </AlertDescription>
      </Alert>

      <div class="flex items-center gap-4">
        <ResumeScore class="size-20 shrink-0" :score="match.matchScore" />
        <p class="text-sm text-muted-foreground">{{ match.verdict }}</p>
      </div>

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
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { PhCheckCircle, PhCircleHalf, PhXCircle } from "@phosphor-icons/vue";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import ResumeScore from "@/components/ResumeScore.vue";
import type { ToolMatch } from "@/types";

type ToolMatchCardProps = {
  match: ToolMatch;
  justSaved?: boolean;
};

const { match, justSaved = false } = defineProps<ToolMatchCardProps>();

const checkedOn = computed(() => {
  const date = new Date(match.checkedAt);
  return Number.isNaN(date.getTime())
    ? ""
    : `Checked ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
});
</script>
