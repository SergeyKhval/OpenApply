<template>
  <div class="flex gap-2">
    <select
      :id="id"
      class="h-11 min-w-0 flex-1 rounded-field border border-input bg-card px-3 text-[15px] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:opacity-50 md:text-sm"
      :aria-label="`${label} month`"
      :disabled="disabled"
      :value="monthText"
      @change="setMonth(($event.target as HTMLSelectElement).value)"
    >
      <option value="">Month</option>
      <option v-for="(name, index) in MONTHS" :key="name" :value="index + 1">{{ name }}</option>
    </select>
    <Input
      class="w-24"
      inputmode="numeric"
      placeholder="Year"
      maxlength="4"
      :aria-label="`${label} year`"
      :disabled="disabled"
      :model-value="yearText"
      @update:model-value="setYear(String($event))"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { Input } from "@/components/ui/input";
import type { YearMonth } from "@/lib/builtResume";

type YearMonthInputProps = { id?: string; label: string; disabled?: boolean };

const { id, label, disabled = false } = defineProps<YearMonthInputProps>();
const model = defineModel<YearMonth | null>({ required: true });

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Both boxes keep what's typed: a year stays "20" until it's a real year, and
// a month picked first (or kept while the year is retyped) waits for one
const yearText = ref(model.value ? String(model.value.year) : "");
const monthText = ref(model.value?.month ? String(model.value.month) : "");
watch(model, (value) => {
  if (!value) return;
  if (String(value.year) !== yearText.value) yearText.value = String(value.year);
  monthText.value = value.month ? String(value.month) : "";
});

const month = () => (monthText.value ? Number(monthText.value) : null);

function setYear(value: string) {
  yearText.value = value.replace(/\D/g, "").slice(0, 4);
  const year = Number(yearText.value);
  if (yearText.value.length === 4 && year >= 1950 && year <= 2100) {
    model.value = { year, month: month() };
  } else if (!yearText.value) {
    model.value = null;
  }
}

function setMonth(value: string) {
  monthText.value = value;
  if (model.value) model.value = { ...model.value, month: month() };
}
</script>
