<template>
  <div class="flex flex-col gap-2">
    <!-- On phones a line's buttons show while it has focus, so the text gets the width -->
    <div v-for="(bullet, index) in bullets" :key="bullet.id" class="group flex flex-wrap items-start gap-1 sm:flex-nowrap">
      <span aria-hidden="true" class="mt-3 text-muted-foreground">•</span>
      <Textarea
        :ref="(element) => setField(bullet.id, element)"
        v-model="bullet.text"
        rows="1"
        class="min-h-11 min-w-0 flex-1 py-2.5"
        :aria-label="`${label} ${index + 1}`"
        :placeholder="index === 0 ? placeholder : ''"
        @keydown.enter.exact="onEnter($event, index)"
        @keydown.backspace="onBackspace($event, index)"
      />
      <ReorderButtons
        size="icon-sm"
        class="w-full justify-end max-sm:hidden max-sm:group-focus-within:flex sm:w-auto"
        :label="`line ${index + 1}`"
        :index="index"
        :count="bullets.length"
        @move="move(index, $event)"
        @remove="remove(index)"
      />
    </div>
    <Button variant="ghost" size="sm" class="self-start" @click="add(bullets.length)">
      <PhPlus :size="16" />
      Add a line
    </Button>
  </div>
</template>

<script setup lang="ts">
import { nextTick } from "vue";
import { PhPlus } from "@phosphor-icons/vue";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import ReorderButtons from "@/components/resume-builder/ReorderButtons.vue";
import { moveInPlace, newBullet } from "@/lib/builtResumeEdit";
import type { ResumeBullet } from "@/lib/builtResume";

type ResumeBulletsEditorProps = { label?: string; placeholder?: string };

const { label = "Line", placeholder = "What you did, and what came of it" } = defineProps<ResumeBulletsEditorProps>();
const bullets = defineModel<ResumeBullet[]>({ required: true });

const fields = new Map<string, HTMLTextAreaElement>();
function setField(id: string, element: unknown) {
  const textarea = (element as { $el?: HTMLElement } | null)?.$el ?? (element as HTMLElement | null);
  if (textarea instanceof HTMLTextAreaElement) fields.set(id, textarea);
  else fields.delete(id);
}

async function focus(index: number, atEnd = true) {
  await nextTick();
  const bullet = bullets.value[index];
  const field = bullet ? fields.get(bullet.id) : undefined;
  if (!field) return;
  field.focus();
  const position = atEnd ? field.value.length : 0;
  field.setSelectionRange(position, position);
}

function add(index: number) {
  bullets.value.splice(index, 0, newBullet());
  void focus(index);
}

function remove(index: number) {
  bullets.value.splice(index, 1);
}

// ReorderButtons keeps focus on the moved line's arrow, for repeated presses
function move(index: number, delta: -1 | 1) {
  moveInPlace(bullets.value, index, delta);
}

// Enter at the end of a line starts the next one, like a list in a notes app
function onEnter(event: KeyboardEvent, index: number) {
  const field = event.target as HTMLTextAreaElement;
  if (field.selectionStart !== field.value.length) return;
  event.preventDefault();
  add(index + 1);
}

// Backspace in an empty line removes it and goes back to the one above
function onBackspace(event: KeyboardEvent, index: number) {
  if (bullets.value[index]?.text !== "" || bullets.value.length === 1) return;
  event.preventDefault();
  remove(index);
  void focus(Math.max(0, index - 1));
}
</script>
