<template>
  <SettingsShell>
    <Card>
      <CardHeader><CardTitle class="text-lg">Appearance</CardTitle></CardHeader>
      <CardContent>
        <RadioGroup :model-value="preference" class="flex flex-col gap-1" aria-label="Theme" @update:model-value="choose">
          <Label
            v-for="option in OPTIONS"
            :key="option.value"
            :for="`theme-${option.value}`"
            class="flex cursor-pointer items-center gap-3 rounded-field px-3 py-3 hover:bg-muted"
          >
            <RadioGroupItem :id="`theme-${option.value}`" :value="option.value" />
            <span class="flex flex-col gap-0.5">
              <span class="text-[15px] font-semibold">{{ option.label }}</span>
              <span class="text-sm font-normal text-muted-foreground">{{ option.hint }}</span>
            </span>
          </Label>
        </RadioGroup>
        <p class="mt-3 text-sm text-muted-foreground">Saved in this browser.</p>
      </CardContent>
    </Card>
  </SettingsShell>
</template>

<script setup lang="ts">
import { ref } from "vue";
import SettingsShell from "@/components/settings/SettingsShell.vue";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { readPreference, setThemePreference, type ThemePreference } from "@/lib/theme";

const OPTIONS: { value: ThemePreference; label: string; hint: string }[] = [
  { value: "system", label: "Match my device", hint: "Light or dark, following your system setting" },
  { value: "light", label: "Light", hint: "Always light" },
  { value: "dark", label: "Dark", hint: "Always dark" },
];

const preference = ref<ThemePreference>(readPreference());

function choose(value: unknown) {
  const next = value as ThemePreference;
  preference.value = next;
  setThemePreference(next);
}
</script>

<route lang="yaml">
meta:
  requiresAuth: true
</route>
