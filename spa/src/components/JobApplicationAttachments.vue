<template>
  <Card>
    <CardHeader>
      <CardTitle>Attachments</CardTitle>
    </CardHeader>
    <CardContent class="flex flex-col gap-4 sm:flex-row">
      <Empty
        class="sm:w-50 relative pb-5 pt-10 px-2 gap-4"
        :class="resumeId && 'border-solid'"
      >
        <Badge variant="secondary" class="absolute top-2 left-2">
          Resume
        </Badge>

        <EmptyIcon
          :class="
            resumeId
              ? 'border-solid text-foreground border-foreground'
              : 'animate-pulse'
          "
        >
          <PhFilePdf v-if="resumeId" :size="36" />
          <PhReadCvLogo v-else :size="36" />
        </EmptyIcon>
        <a
          v-if="resume"
          class="truncate max-w-full text-xs text-primary hover:underline"
          target="_blank"
          :href="resume.url"
        >
          {{ resume.fileName }}
        </a>
        <EmptyDescription class="text-foreground">
          <div v-if="resumeId" class="items-center gap-2 flex">
            <Button
              size="sm"
              variant="outline"
              @click="
                $router.replace({
                  query: {
                    ...$route.query,
                    'dialog-name': 'resume-picker',
                    'application-id': applicationId,
                    'resume-id': resumeId,
                  },
                })
              "
            >
              <PhPencilSimple />
              Change
            </Button>
          </div>
          <template v-else>
            <Tooltip>
              <TooltipTrigger>
                <Button
                  variant="outline"
                  size="sm"
                  @click="
                    $router.replace({
                      query: {
                        ...$route.query,
                        'dialog-name': 'resume-picker',
                        'application-id': applicationId,
                        'resume-id': resumeId,
                      },
                    })
                  "
                >
                  <PhFilePdf />
                  Attach
                </Button>
              </TooltipTrigger>
              <TooltipContent class="text-center">
                You will be able to do AI review <br />
                once you attach a resume.
              </TooltipContent>
            </Tooltip>
          </template>
        </EmptyDescription>
      </Empty>

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
  PhPencilSimple,
  PhReadCvLogo,
  PhSparkle,
} from "@phosphor-icons/vue";
import { Button } from "@/components/ui/button";
import { useDocument } from "vuefire";
import { Resume } from "@/types";
import { collection, doc } from "firebase/firestore";
import { db } from "@/firebase/config.ts";
import { computed } from "vue";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type JobApplicationAttachmentsProps = {
  applicationId: string;
  resumeId?: string;
  coverLetterId?: string;
};

const {
  applicationId,
  resumeId = "",
  coverLetterId = "",
} = defineProps<JobApplicationAttachmentsProps>();

const resumeRef = computed(() =>
  resumeId ? doc(collection(db, "userResumes"), resumeId) : null,
);
const resume = useDocument<Resume>(resumeRef);
</script>
