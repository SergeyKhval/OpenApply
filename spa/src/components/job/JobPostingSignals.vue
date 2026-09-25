<!-- Job page: dated facts about the posting (flag job-signals). Amber only, never a verdict. -->
<template>
  <Card class="gap-3 border border-signal/30 bg-signal-soft/60 shadow-none dark:bg-signal-soft/40" aria-labelledby="posting-signals-title">
    <CardHeader class="flex flex-row items-center justify-between gap-2">
      <CardTitle id="posting-signals-title" class="flex items-center gap-2 text-base text-signal-text">
        <span class="size-2 rounded-full" :class="hasRed ? 'bg-destructive' : 'bg-signal'" aria-hidden="true" />
        Posting signals
      </CardTitle>
      <Popover @update:open="(open: boolean) => open && trackEvent('job_signals_explained', { surface: 'app_page' })">
        <PopoverTrigger as-child>
          <Button variant="ghost" size="sm" class="-mr-2 h-7 text-signal-text hover:bg-signal/15 hover:text-signal-text">
            <PhInfo />
            What these mean
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" class="flex w-80 flex-col gap-2 text-sm">
          <p>
            These are facts about the posting, each with its date and where it came from: the posting's own data, its
            title, jobs saved on OpenApply, and reports from people who saved it. A report shows once three people made
            it within six months.
          </p>
          <p class="text-soft-foreground">
            They don't say why a role is still open. Many long-open roles are real and still hiring. Use them to decide
            how much time to spend, and ask the recruiter when in doubt.
          </p>
        </PopoverContent>
      </Popover>
    </CardHeader>
    <CardContent class="flex flex-col gap-3">
      <ul class="flex flex-col gap-3">
        <li v-for="line in lines" :key="line.type" class="flex gap-2.5">
          <component
            :is="ICONS[line.type]"
            :size="18"
            class="mt-0.5 shrink-0"
            :class="line.tone === 'red' ? 'text-destructive' : 'text-signal'"
            aria-hidden="true"
          />
          <div class="flex min-w-0 flex-col gap-0.5">
            <span class="text-[15px] font-semibold text-foreground">{{ line.text }}</span>
            <span class="text-[13px] text-muted-foreground">Source: {{ line.source }}</span>
          </div>
        </li>
      </ul>
      <RouterLink
        :to="{ path: '/posting-review', query: { job: keyHash } }"
        class="self-start text-[13px] font-medium text-signal-text underline-offset-2 hover:underline"
      >
        Is this your posting? Ask for a review
      </RouterLink>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { computed, watch } from "vue";
import {
  PhArrowsClockwise,
  PhCalendarDots,
  PhClock,
  PhCopy,
  PhCurrencyCircleDollar,
  PhInfo,
  PhTag,
  PhUsersThree,
} from "@phosphor-icons/vue";
import { trackEvent } from "@/analytics";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { SignLine, SignType } from "@/lib/jobSignals";

const { lines, keyHash } = defineProps<{ lines: SignLine[]; keyHash: string }>();

const ICONS: Record<SignType, typeof PhClock> = {
  still_listed: PhClock,
  posted: PhCalendarDots,
  date_refreshed: PhArrowsClockwise,
  same_role: PhCopy,
  open_application: PhTag,
  report_asked_for_money: PhCurrencyCircleDollar,
  report_no_reply_30d: PhUsersThree,
  report_reposted_after_rejection: PhUsersThree,
  report_filled_still_listed: PhUsersThree,
};

const hasRed = computed(() => lines.some((line) => line.tone === "red"));


watch(
  () => lines.map((line) => line.type).join(","),
  (types) => {
    if (types) trackEvent("job_signals_shown", { surface: "app_page", sign_types: types.split(",") });
  },
  { immediate: true },
);
</script>
