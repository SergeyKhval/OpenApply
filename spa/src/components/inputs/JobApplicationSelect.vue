<template>
  <div class="space-y-2 max-w-full">
    <Label>Job Application</Label>
    <Select v-model="selectedJobApplicationId">
      <SelectTrigger class="w-full truncate">
        <SelectValue placeholder="Select a job application" />
      </SelectTrigger>
      <SelectContent class="max-w-[calc(100vw-5rem)]">
        <SelectItem
          v-for="app in filteredJobApplications"
          :key="app.id"
          :value="app.id"
        >
          <div class="flex items-center gap-2">
            <img
              v-if="app.companyLogoUrl"
              :src="app.companyLogoUrl"
              :alt="`${app.companyName} logo`"
              class="w-6 h-6 rounded object-cover"
            />
            <div
              v-else
              class="w-6 h-6 rounded bg-gray-100 flex items-center justify-center"
            >
              <PhBuildings :size="12" class="text-gray-400" />
            </div>
            <div>
              <span class="font-medium">{{ app.companyName }}</span>
              <span class="text-muted-foreground"> - {{ app.position }}</span>
            </div>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  </div>
</template>

<script setup lang="ts">
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PhBuildings } from "@phosphor-icons/vue";
import { Label } from "@/components/ui/label";
import { computed } from "vue";
import { useJobApplicationsData } from "@/composables/useJobApplicationsData.ts";

const selectedJobApplicationId = defineModel<string>();

const { jobApplications } = useJobApplicationsData();
const filteredJobApplications = computed(() =>
  jobApplications.value.filter((a) => a.status !== "archived"),
);
</script>
