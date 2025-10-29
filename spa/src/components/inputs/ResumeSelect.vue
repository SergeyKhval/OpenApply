<template>
  <div class="flex flex-col gap-2">
    <Label>Resume</Label>
    <Select v-model="selectedResumeId">
      <SelectTrigger class="w-full">
        <SelectValue placeholder="Select a resume" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          v-for="resume in resumes"
          :key="resume.id"
          :value="resume.id"
        >
          <div class="flex items-center gap-2">
            <PhFile :size="16" class="text-gray-400" />
            <span>{{ resume.fileName }}</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PhFile } from "@phosphor-icons/vue";
import { Label } from "@/components/ui/label";
import { useResumes } from "@/composables/useResumes.ts";

const selectedResumeId = defineModel<string>();

const resumesCollection = useResumes();
const resumes = computed(() =>
  resumesCollection.value.filter((r) => r.status === "parsed"),
);
</script>
