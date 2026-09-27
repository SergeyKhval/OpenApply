<template>
  <div class="flex shrink-0 items-center">
    <Button ref="up" variant="ghost" :size="size" :aria-label="`Move ${label} up`" :disabled="index === 0" @click="move(-1)">
      <PhArrowUp :size="16" />
    </Button>
    <Button ref="down" variant="ghost" :size="size" :aria-label="`Move ${label} down`" :disabled="index >= count - 1" @click="move(1)">
      <PhArrowDown :size="16" />
    </Button>
    <Button variant="ghost" :size="size" :aria-label="`Delete ${label}`" @click="emit('remove')">
      <PhTrash :size="16" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { nextTick, useTemplateRef } from "vue";
import { PhArrowDown, PhArrowUp, PhTrash } from "@phosphor-icons/vue";
import { Button } from "@/components/ui/button";

// "icon" (44px) for sections and entries; bullet rows use "icon-sm" to fit a phone
type ReorderButtonsProps = { label: string; index: number; count: number; size?: "icon" | "icon-sm" };

const { label, index, count, size = "icon" } = defineProps<ReorderButtonsProps>();
const emit = defineEmits<{
  (event: "move", delta: -1 | 1): void;
  (event: "remove"): void;
}>();

const up = useTemplateRef<{ $el: HTMLButtonElement }>("up");
const down = useTemplateRef<{ $el: HTMLButtonElement }>("down");

// Focus follows the moved item: the DOM move drops it, and at either end the
// pressed arrow turns disabled, so the other arrow takes it
async function move(delta: -1 | 1) {
  emit("move", delta);
  await nextTick();
  const pressed = (delta < 0 ? up : down).value?.$el;
  const other = (delta < 0 ? down : up).value?.$el;
  (pressed && !pressed.disabled ? pressed : other)?.focus();
}
</script>
