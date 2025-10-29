<template>
  <Card>
    <CardHeader>
      <CardTitle>Job Description</CardTitle>
    </CardHeader>

    <CardContent>
      <Textarea
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
      <Button size="sm" @click="updateJobDescription()">
        <PhFloppyDisk />
        Update
      </Button>
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
import { PhFloppyDisk } from "@phosphor-icons/vue";
import { Textarea } from "@/components/ui/textarea";
import { collection, doc, updateDoc } from "firebase/firestore";
import { db } from "@/firebase/config.ts";
import { useToast } from "@/components/ui/toast";

type JobApplicationDescriptionProps = {
  application: {
    id: string;
    jobDescription: string;
  };
};

const { application } = defineProps<JobApplicationDescriptionProps>();

const { toast } = useToast();

const jobDescription = ref(application.jobDescription);

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
}
</script>
