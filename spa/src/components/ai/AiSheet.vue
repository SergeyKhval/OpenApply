<!-- Side sheet for the AI tools (resume match, cover letter): from the right
     on desktop, from the bottom on phones -->
<template>
  <Sheet :open="open" @update:open="emit('update:open', $event)">
    <SheetContent
      :side="isDesktop ? 'right' : 'bottom'"
      class="gap-0 p-0 max-lg:max-h-[92dvh] lg:w-full lg:max-w-[540px]"
    >
      <SheetHeader class="gap-1 px-6 pt-6 pb-4 pr-14">
        <p v-if="eyebrow" class="truncate text-sm text-muted-foreground">{{ eyebrow }}</p>
        <SheetTitle class="font-display text-2xl font-extrabold tracking-tight">{{ title }}</SheetTitle>
        <SheetDescription :class="{ 'sr-only': !$slots.description }">
          <slot name="description">{{ title }}</slot>
        </SheetDescription>
      </SheetHeader>
      <div class="flex min-h-0 grow flex-col gap-5 overflow-y-auto px-6 pb-6">
        <slot />
      </div>
      <div v-if="$slots.footer" class="flex flex-col gap-3 border-t border-border px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <slot name="footer" />
      </div>
    </SheetContent>
  </Sheet>
</template>

<script setup lang="ts">
import { useMediaQuery } from "@vueuse/core";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type AiSheetProps = {
  open: boolean;
  title: string;
  eyebrow?: string;
};

type AiSheetEmits = {
  (event: "update:open", value: boolean): void;
};

const { open, title, eyebrow } = defineProps<AiSheetProps>();
const emit = defineEmits<AiSheetEmits>();

const isDesktop = useMediaQuery("(min-width: 1024px)");
</script>
