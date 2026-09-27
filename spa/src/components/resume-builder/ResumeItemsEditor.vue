<template>
  <!-- Skills and languages: short tags. Certifications and awards: a line each -->
  <TagsInput v-if="asTags" v-model="items" :aria-label="label">
    <TagsInputItem v-for="(item, index) in items" :key="`${item}-${index}`" :value="item">
      <TagsInputItemText class="px-2">{{ item }}</TagsInputItemText>
      <TagsInputItemDelete>
        <PhX :size="12" />
      </TagsInputItemDelete>
    </TagsInputItem>
    <TagsInputInput :placeholder="placeholder" class="flex-1" />
  </TagsInput>
  <div v-else class="flex flex-col gap-2">
    <div v-for="(item, index) in items" :key="index" class="group flex flex-wrap items-center gap-1 sm:flex-nowrap">
      <Input
        class="min-w-0 flex-1"
        :model-value="item"
        :aria-label="`${label} ${index + 1}`"
        :placeholder="index === 0 ? placeholder : ''"
        @update:model-value="items[index] = String($event)"
      />
      <ReorderButtons
        size="icon-sm"
        class="w-full justify-end max-sm:hidden max-sm:group-focus-within:flex sm:w-auto"
        :label="`${label} ${index + 1}`"
        :index="index"
        :count="items.length"
        @move="moveInPlace(items, index, $event)"
        @remove="items.splice(index, 1)"
      />
    </div>
    <Button variant="ghost" size="sm" class="self-start" @click="items.push('')">
      <PhPlus :size="16" />
      Add one
    </Button>
  </div>
</template>

<script setup lang="ts">
import { PhPlus, PhX } from "@phosphor-icons/vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TagsInput, TagsInputInput, TagsInputItem, TagsInputItemDelete, TagsInputItemText } from "@/components/ui/tags-input";
import ReorderButtons from "@/components/resume-builder/ReorderButtons.vue";
import { moveInPlace } from "@/lib/builtResumeEdit";

type ResumeItemsEditorProps = { label: string; placeholder: string; asTags: boolean };

const { label, placeholder, asTags } = defineProps<ResumeItemsEditorProps>();
const items = defineModel<string[]>({ required: true });
</script>
