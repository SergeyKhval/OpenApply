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
          :class="resumeId && 'border-solid text-foreground border-foreground'"
        >
          <PhFilePdf v-if="resumeId" :size="36" />
          <PhReadCvLogo v-else :size="36" />
        </EmptyIcon>
        <EmptyDescription class="text-foreground">
          <div v-if="resumeId" class="items-center gap-2 flex">
            <Button size="sm" variant="outline" @click="openResume">
              <PhEye />
              View
            </Button>
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
          :class="{
            'border-solid text-foreground border-foreground': coverLetterId,
          }"
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
import { watchEffect } from "vue";

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

async function openResume() {
  if (!resumeId) return;

  const resume = useDocument<Resume>(
    doc(collection(db, "userResumes"), resumeId),
    { once: true },
  );

  const unwatch = watchEffect(() => {
    if (resume.value?.url) {
      window.open(resume.value.url, "_blank");
      unwatch();
    }
  });
}
</script>
