<template>
  <Card>
    <CardHeader class="mb-4">
      <CardTitle>Documents</CardTitle>
    </CardHeader>
    <CardContent class="flex flex-col gap-6">
      <template v-if="resumes.length">
        <div>
          <h3 class="mb-2">Resumes</h3>
          <div class="flex flex-col gap-4 sm:flex-row flex-wrap">
            <Empty
              class="group sm:w-50 hover:border-solid cursor-pointer pb-5 pt-10 px-2 gap-4"
              @click="openFileDialog()"
            >
              <EmptyIcon class="group-hover:border-solid">
                <PhPlus />
              </EmptyIcon>
              <EmptyDescription>
                Upload another resume.
                <br />
                Resumes are available for all your applications.
              </EmptyDescription>
            </Empty>
            <ResumeAttachmentCard
              v-for="resume in resumes"
              :key="resume.id"
              :resume="resume"
              :application-id="applicationId"
            />
          </div>
        </div>

        <div>
          <h3 class="mb-2">Cover Letters</h3>
          <div class="flex flex-col gap-4 sm:flex-row">
            <Empty
              class="sm:w-50 pb-5 pt-10 px-2 gap-4 relative"
              :class="{ 'border-solid': coverLetterId }"
            >
              <Badge variant="secondary" class="absolute top-2 left-2">
                Cover Letter
              </Badge>
              <EmptyIcon
                :class="
                  coverLetterId
                    ? 'border-solid text-foreground border-foreground'
                    : 'animate-pulse'
                "
              >
                <PhEnvelopeSimpleOpen v-if="coverLetterId" :size="36" />
                <PhEnvelopeSimple v-else :size="36" />
              </EmptyIcon>
              <EmptyDescription class="text-foreground">
                <Button
                  v-if="coverLetterId"
                  variant="outline"
                  size="sm"
                  @click="
                    $router.replace({
                      query: {
                        ...$route.query,
                        'dialog-name': 'cover-letter-preview',
                        'cover-letter-id': coverLetterId,
                      },
                    })
                  "
                >
                  <PhEye />
                  View
                </Button>
                <Button
                  v-else
                  size="sm"
                  variant="outline"
                  @click="
                    $router.replace({
                      query: {
                        ...$route.query,
                        'dialog-name': 'generate-cover-letter',
                        'application-id': applicationId,
                      },
                    })
                  "
                >
                  <PhSparkle />
                  Generate
                </Button>
              </EmptyDescription>
            </Empty>
          </div>
        </div>
      </template>
      <div
        v-else
        class="text-muted-foreground flex flex-col items-center gap-2"
      >
        <PhFilePdf size="64" />
        <p class="text-center mb-4">
          Upload your first resume and get an AI-powered review against this job
          plus actionable fixes. <br />Then instantly generate a job‑tailored
          cover letter.
        </p>
        <Button size="sm" variant="outline" @click="openFileDialog">
          <PhFilePdf />
          Upload first resume
        </Button>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyIcon } from "@/components/ui/empty";
import {
  PhEnvelopeSimple,
  PhEnvelopeSimpleOpen,
  PhEye,
  PhFilePdf,
  PhPlus,
  PhSparkle,
} from "@phosphor-icons/vue";
import { Button } from "@/components/ui/button";
import ResumeAttachmentCard from "@/components/ResumeAttachmentCard.vue";
import { useResumes } from "@/composables/useResumes.ts";
import { useResumeUpload } from "@/composables/useResumeUpload.ts";

type JobApplicationAttachmentsProps = {
  applicationId: string;
  coverLetterId?: string;
};

const { applicationId, coverLetterId = "" } =
  defineProps<JobApplicationAttachmentsProps>();

const resumes = useResumes();
const { openFileDialog } = useResumeUpload();
</script>
