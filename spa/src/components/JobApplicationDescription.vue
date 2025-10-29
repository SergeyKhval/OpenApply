<template>
  <Card>
    <CardHeader>
      <CardTitle>Job Description</CardTitle>
    </CardHeader>

    <CardContent>
      <template v-if="viewMode === 'view'">
        <p :class="isWholeDescriptionVisible ? '' : 'line-clamp-5'">
          {{ jobDescription }}
        </p>
        <Button
          size="sm"
          variant="link"
          @click="isWholeDescriptionVisible = !isWholeDescriptionVisible"
        >
          <PhEye />
          {{ isWholeDescriptionVisible ? "Show less" : "Show more" }}
        </Button>
      </template>
      <Textarea
        v-else
        v-model="jobDescription"
        class="max-h-50"
        :class="
          v$.jobDescription.$dirty &&
          v$.jobDescription.$invalid &&
          'border-destructive'
        "
        required
      />
      <p
        v-if="v$.jobDescription.$dirty && v$.jobDescription.$invalid"
        class="text-xs text-destructive mt-1"
      >
        Job Description can't be empty
      </p>
    </CardContent>
    <CardFooter class="justify-end">
      <Button v-if="viewMode === 'view'" size="sm" @click="viewMode = 'edit'">
        <PhPencilSimple />
        Edit
      </Button>
      <div v-else class="flex gap-2 items-center">
        <Button size="sm" @click="updateJobDescription()">
          <PhCheckFat />
          Save</Button
        >
        <Button size="sm" variant="secondary" @click="viewMode = 'view'">
          <PhRewind />
          Cancel</Button
        >
      </div>
    </CardFooter>
  </Card>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useVuelidate } from "@vuelidate/core";
import { required } from "@vuelidate/validators";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  PhCheckFat,
  PhEye,
  PhPencilSimple,
  PhRewind,
} from "@phosphor-icons/vue";
import { Textarea } from "@/components/ui/textarea";
import { collection, doc, updateDoc } from "firebase/firestore";
import { db } from "@/firebase/config.ts";
import { useToast } from "@/components/ui/toast";
import { onKeyStroke } from "@vueuse/core";

type JobApplicationDescriptionProps = {
  application: {
    id: string;
    jobDescription: string;
  };
};

const { application } = defineProps<JobApplicationDescriptionProps>();

const { toast } = useToast();

const jobDescription = ref(application.jobDescription);
const isWholeDescriptionVisible = ref(false);
const viewMode = ref<"view" | "edit">("view");

const v$ = useVuelidate(
  {
    jobDescription: {
      required,
    },
  },
  { jobDescription },
);

async function updateJobDescription() {
  v$.value.$touch();
  if (v$.value.$invalid) {
    return;
  }

  await updateDoc(doc(collection(db, "jobApplications"), application.id), {
    jobDescription: jobDescription.value,
  });

  toast({
    title: "Success",
    description: "Job description updated successfully.",
    duration: 3000,
  });
  viewMode.value = "view";
}

onKeyStroke("Escape", () => {
  if (viewMode.value === "edit") {
    viewMode.value = "view";
    jobDescription.value = application.jobDescription;
    v$.value.$reset();
  }
});
</script>
