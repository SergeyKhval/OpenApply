<template>
  <Card>
    <CardHeader>
      <CardTitle>Attachments</CardTitle>
    </CardHeader>
    <CardContent class="flex flex-col gap-6">
      <div>
        <h3 class="mb-2">Resumes</h3>
        <div class="flex flex-col gap-4 sm:flex-row">
          <ResumeAttachmentCard
            v-for="resume in resumes"
            :key="resume.id"
            :resume-id="resume.id"
            :application-id="applicationId"
            :file-name="resume.fileName"
            :url="resume.url"
            :is-attached="resumeId === resume.id"
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
  PhSparkle,
} from "@phosphor-icons/vue";
import { Button } from "@/components/ui/button";
import ResumeAttachmentCard from "@/components/ResumeAttachmentCard.vue";
import { useResumes } from "@/composables/useResumes.ts";

type JobApplicationAttachmentsProps = {
  applicationId: string;
  resumeId?: string | null;
  coverLetterId?: string;
};

const {
  applicationId,
  resumeId = "",
  coverLetterId = "",
} = defineProps<JobApplicationAttachmentsProps>();

const resumes = useResumes();
</script>
