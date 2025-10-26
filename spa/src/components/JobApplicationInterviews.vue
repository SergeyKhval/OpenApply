<template>
  <Card>
    <CardHeader>
      <CardTitle>Interviews</CardTitle>
    </CardHeader>
    <CardContent>
      <template v-if="viewMode === 'view'">
        <div v-if="interviews.length">
          <div v-if="upcomingInterviews.length" class="mb-6">
            <h3 class="text-sm font-semibold text-muted-foreground mb-3">
              Upcoming
            </h3>
            <InterviewList
              :interviews="upcomingInterviews"
              @edit="handleEditInterview"
              @delete="deleteInterview"
            />
          </div>

          <div v-if="pastInterviews.length" class="mb-6">
            <h3 class="text-sm font-semibold text-muted-foreground mb-3">
              Past
            </h3>
            <InterviewList
              :interviews="pastInterviews"
              @edit="handleEditInterview"
              @delete="deleteInterview"
            />
          </div>

          <div class="flex justify-end">
            <Button size="sm" @click="viewMode = 'form'">
              <PhCalendar />
              Add Interview
            </Button>
          </div>
        </div>
        <div
          v-else
          class="text-muted-foreground flex flex-col items-center gap-2"
        >
          <PhUsersThree size="64" />
          <p class="text-center mb-4">
            You don't have any interviews for this role. Let's schedule?
          </p>
          <Button size="sm" @click="viewMode = 'form'">
            <PhVideoConference />
            Add first interview
          </Button>
        </div>
      </template>

      <InterviewForm
        v-else
        :interview="
          selectedInterview
            ? pick(selectedInterview, ['name', 'conductedAt'])
            : {
                name: '',
              }
        "
        @save="onInterviewFormSave"
        @cancel="viewMode = 'view'"
      />
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useCollection, useCurrentUser } from "vuefire";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/firebase/config.ts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PhCalendar,
  PhUsersThree,
  PhVideoConference,
} from "@phosphor-icons/vue";
import { type Interview, type InterviewFormInterview } from "@/types";
import { Button } from "@/components/ui/button";
import InterviewForm from "@/components/InterviewForm.vue";
import InterviewList from "@/components/InterviewList.vue";
import pick from "lodash/pick";

type JobApplicationInterviewsProps = {
  applicationId: string;
};

const { applicationId } = defineProps<JobApplicationInterviewsProps>();

const user = useCurrentUser();

const viewMode = ref<"view" | "form">("view");
const selectedInterviewId = ref("");
const selectedInterview = computed(() =>
  interviews.value.find((contact) => contact.id === selectedInterviewId.value),
);

const q = computed(() =>
  user.value
    ? query(
        collection(db, "interviews"),
        where("userId", "==", user.value.uid),
        where("applicationId", "==", applicationId),
        orderBy("conductedAt", "asc"),
      )
    : null,
);
const { data: interviews } = useCollection<Interview>(q);

const now = new Date();
const upcomingInterviews = computed(() =>
  interviews.value.filter((interview) =>
    interview.conductedAt.toDate() >= now
  )
);

const pastInterviews = computed(() =>
  interviews.value
    .filter((interview) => interview.conductedAt.toDate() < now)
    .reverse()
);

async function addInterview(interviewForm: InterviewFormInterview) {
  if (!user.value) return;

  await addDoc(collection(db, "interviews"), {
    name: interviewForm.name,
    conductedAt: interviewForm.conductedAt.toDate(),
    status: "pending",
    createdAt: serverTimestamp(),
    userId: user.value.uid,
    applicationId,
  });

  viewMode.value = "view";
}

async function updateInterview(interview: InterviewFormInterview) {
  await updateDoc(doc(db, "interviews", selectedInterviewId.value), {
    ...interview,
    conductedAt: interview.conductedAt.toDate(),
  });

  viewMode.value = "view";
}

function handleEditInterview(interviewId: string) {
  selectedInterviewId.value = interviewId;
  viewMode.value = "form";
}

function deleteInterview(interviewId: string) {
  const ok = confirm("Are you sure you want to delete this interview?");
  if (ok) deleteDoc(doc(db, "interviews", interviewId));
}

async function onInterviewFormSave(interview: InterviewFormInterview) {
  if (!user.value) return;

  if (selectedInterviewId.value) {
    await updateInterview(interview);
  } else {
    await addInterview(interview);
  }

  selectedInterviewId.value = "";
  viewMode.value = "view";
}
</script>
