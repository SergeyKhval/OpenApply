<template>
  <form class="flex flex-col gap-6" @submit.prevent="handleSubmit">
    <Alert v-if="parsingFailed" variant="default">
      <PhInfo class="text-muted-foreground" />
      <AlertDescription>
        We couldn't automatically extract all job details from the provided
        link. Please fill in the information manually.
      </AlertDescription>
    </Alert>
    <div class="flex flex-col gap-2">
      <Label for="company">Company Name</Label>
      <Input
        id="company"
        v-model="formData.companyName"
        placeholder="e.g., Google"
        required
      />
    </div>

    <div class="flex flex-col gap-2">
      <Label for="position">Position</Label>
      <Input
        id="position"
        v-model="formData.position"
        placeholder="e.g., Senior Software Engineer"
        required
      />
    </div>

    <div class="flex flex-col gap-2">
      <Label for="remotePolicy">Remote Policy (optional)</Label>
      <Select v-model="formData.remotePolicy">
        <SelectTrigger id="remotePolicy" class="w-full">
          <SelectValue placeholder="Select remote policy" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="remote">Remote</SelectItem>
          <SelectItem value="hybrid">Hybrid</SelectItem>
          <SelectItem value="in-office">In-Office</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="flex flex-col gap-2">
      <Label for="employmentType">Employment Type (optional)</Label>
      <Select v-model="formData.employmentType">
        <SelectTrigger id="employmentType" class="w-full">
          <SelectValue placeholder="Select employment type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="full-time">Full-time</SelectItem>
          <SelectItem value="part-time">Part-time</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="flex flex-col gap-2">
      <Label for="technologies">Tags (optional)</Label>
      <TagsInput id="technologies" v-model="formData.technologies">
        <TagsInputItem
          v-for="(item, index) in formData.technologies"
          :key="index"
          :value="item"
        >
          <TagsInputItemText class="px-2">{{ item }}</TagsInputItemText>
          <TagsInputItemDelete>
            <PhX :size="12" />
          </TagsInputItemDelete>
        </TagsInputItem>
        <TagsInputInput placeholder="Add tags..." class="flex-1" />
      </TagsInput>
    </div>

    <div v-if="error" class="text-destructive text-sm">
      {{ error }}
    </div>

    <DialogFooter>
      <Button type="submit" :disabled="isSubmitting">
        <template v-if="isSubmitting">
          <PhSpinner class="animate-spin" />
          Saving...
        </template>
        <template v-else>
          <PhFloppyDisk />
          Save
        </template>
      </Button>
      <Button type="button" variant="outline" @click="emit('back')">
        <PhRewind />
        Back
      </Button>
    </DialogFooter>
  </form>
</template>

<script setup lang="ts">
import { ref, reactive } from "vue";
import {
  PhFloppyDisk,
  PhRewind,
  PhSpinner,
  PhX,
  PhInfo,
} from "@phosphor-icons/vue";
import { useJobApplications } from "@/composables/useJobApplications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TagsInput,
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDelete,
  TagsInputItemText,
} from "@/components/ui/tags-input";
import { DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

type JobApplicationFormProps = {
  jobId?: string;
  companyName?: string;
  companyLogoUrl?: string;
  position?: string;
  remotePolicy?: "remote" | "hybrid" | "in-office";
  employmentType?: "full-time" | "part-time";
  technologies?: string[];
  jobDescriptionLink?: string;
  parsingFailed?: boolean;
};
type JobApplicationFormEmits = {
  (event: "saved", id: string): void;
  (event: "back"): void;
};

const {
  jobId = "",
  companyName = "",
  companyLogoUrl = "",
  position = "",
  remotePolicy = "",
  employmentType = "",
  technologies = [],
  jobDescriptionLink = "",
  parsingFailed = false,
} = defineProps<JobApplicationFormProps>();
const emit = defineEmits<JobApplicationFormEmits>();

const { addJobApplication } = useJobApplications();

const isDatePickerOpen = ref(false);

const isSubmitting = ref(false);
const error = ref<string | null>(null);

function getInitialForm() {
  return {
    companyName,
    companyLogoUrl,
    position,
    remotePolicy,
    employmentType,
    jobDescriptionLink,
    jobId,
    technologies: technologies.slice(),
  };
}

const formData = reactive(getInitialForm());

const resetForm = () => {
  Object.assign(formData, getInitialForm());
  error.value = null;
};

const handleSubmit = async () => {
  isSubmitting.value = true;
  error.value = null;

  // @ts-expect-error formData completely complies with type from receiving function
  const result = await addJobApplication(formData);

  if (result.success) {
    resetForm();
    emit("saved", result.id ?? "");
  } else {
    error.value = result.error || "Failed to add job application";
  }

  isSubmitting.value = false;
};

// @ts-expect-error - Used in template for Calendar component
const handleDateSelect = () => {
  isDatePickerOpen.value = false;
};
</script>
