<template>
  <div class="relative grow hidden lg:block max-w-100">
    <PhMagnifyingGlass
      :size="20"
      class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
    />
    <Input
      v-model="model"
      type="text"
      placeholder="Search by company name or position..."
      class="pl-10 pr-10"
    />
    <button
      v-if="model"
      class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
      @click="model = ''"
    >
      <PhX :size="20" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { PhMagnifyingGlass, PhX } from "@phosphor-icons/vue";
import { Input } from "@/components/ui/input";

const model = defineModel<string>();
</script>
