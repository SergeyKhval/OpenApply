<!-- A small single-choice pill group (cover letter Length and Tone) -->
<template>
  <div class="flex items-center gap-3">
    <span :id="labelId" class="w-16 shrink-0 text-sm font-semibold">{{ label }}</span>
    <div role="radiogroup" :aria-labelledby="labelId" class="inline-flex gap-0.5 rounded-full bg-muted p-1" @keydown="onKeydown">
      <button
        v-for="option in options"
        :key="option.value"
        ref="buttons"
        type="button"
        role="radio"
        :aria-checked="option.value === modelValue"
        :tabindex="option.value === modelValue ? 0 : -1"
        :disabled="disabled"
        class="h-9 rounded-full px-4 text-sm font-medium text-foreground/80 disabled:opacity-60"
        :class="{ 'bg-card font-semibold text-foreground shadow-card': option.value === modelValue }"
        @click="emit('update:modelValue', option.value)"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T extends string">
import { useId, useTemplateRef } from "vue";

type ChoicePillsProps = {
  label: string;
  options: { value: T; label: string }[];
  modelValue: T;
  disabled?: boolean;
};

type ChoicePillsEmits = {
  (event: "update:modelValue", value: T): void;
};

const { label, options, modelValue, disabled = false } = defineProps<ChoicePillsProps>();
const emit = defineEmits<ChoicePillsEmits>();

const labelId = useId();
const buttons = useTemplateRef<HTMLButtonElement[]>("buttons");

// Arrow keys move the choice, as in a native radio group
function onKeydown(event: KeyboardEvent) {
  const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
  if (!step || disabled) return;
  event.preventDefault();
  const current = options.findIndex((option) => option.value === modelValue);
  const next = (current + step + options.length) % options.length;
  emit("update:modelValue", options[next].value);
  buttons.value?.[next]?.focus();
}
</script>
