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

        <ResumeScore
          v-if="resumeJobMatch"
          class="absolute top-2 right-2 size-8"
          :score="
            resumeJobMatch.matchResult.match_summary.overall_match_percent
          "
        />

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
            <Dialog>
              <DialogTrigger as-child>
                <Button size="sm" variant="outline">
                  <PhScales />
                  Review
                </Button>
              </DialogTrigger>

              <DialogScrollContent class="sm:max-w-150">
                <DialogHeader>
                  <DialogTitle>AI Resume Reviewer</DialogTitle>
                  <DialogDescription>
                    Check how your resume matches with the vacancy and get
                    actionable feedback
                  </DialogDescription>
                </DialogHeader>

                <div>
                  <div v-if="resumeJobMatch">
                    <div class="flex flex-col items-center justify-around mb-8">
                      <ResumeScore
                        class="size-35"
                        :score="
                          resumeJobMatch.matchResult.match_summary
                            .overall_match_percent
                        "
                      />
                      <p>Your overall match score</p>
                    </div>
                    <Tabs default-value="summary">
                      <TabsList class="w-full">
                        <TabsTrigger value="summary">Summary</TabsTrigger>
                        <TabsTrigger value="recommendations"
                          >Recommendations</TabsTrigger
                        >
                        <TabsTrigger value="skills">Skills</TabsTrigger>
                      </TabsList>
                      <TabsContent value="summary">
                        <p class="text-base/7">
                          {{ resumeJobMatch.matchResult.match_summary.summary }}
                        </p>
                      </TabsContent>
                      <TabsContent value="recommendations">
                        <ul
                          class="list-disc list-outside pl-5 text-base/7 flex flex-col gap-4"
                        >
                          <li
                            v-for="recommendation in resumeJobMatch.matchResult
                              .recommendations.improvement_areas"
                          >
                            {{ recommendation }}
                          </li>
                        </ul>
                      </TabsContent>
                      <TabsContent
                        value="skills"
                        class="max-h-75 overflow-y-auto"
                      >
                        <table class="text-xs">
                          <thead>
                            <tr class="text-left">
                              <th></th>
                              <th>Skill</th>
                              <th>Notes</th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-border">
                            <tr
                              v-for="skill in resumeJobMatch.matchResult
                                .skills_comparison.missing_skills"
                              :key="skill.skill"
                            >
                              <td class="pr-2">
                                <PhXCircle
                                  size="16"
                                  class="text-destructive shrink-0"
                                />
                              </td>
                              <td class="py-2 pr-2">
                                {{ skill.skill }}
                              </td>
                              <td class="py-2 pr-2 italic leading-5">
                                {{ skill.evidence || "N/A" }}
                              </td>
                            </tr>
                            <tr
                              v-for="skill in resumeJobMatch.matchResult
                                .skills_comparison.partially_matched_skills"
                              :key="skill.skill"
                            >
                              <td class="pr-2">
                                <PhWarningCircle
                                  size="16"
                                  class="shrink-0 text-yellow-500"
                                />
                              </td>
                              <td class="py-2 pr-2">
                                {{ skill.skill }}
                              </td>

                              <td class="py-2 pr-2 italic leading-5">
                                {{ skill.evidence }}
                              </td>
                            </tr>
                            <tr
                              v-for="skill in resumeJobMatch.matchResult
                                .skills_comparison.matched_skills"
                              :key="skill.skill"
                            >
                              <td class="pr-2">
                                <PhCheckFat
                                  size="16"
                                  weight="fill"
                                  class="text-emerald-600"
                                />
                              </td>
                              <td class="py-2 pr-2">{{ skill.skill }}</td>
                              <td class="py-2 pr-2 leading-5 italic">
                                {{ skill.evidence }}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </TabsContent>
                    </Tabs>
                  </div>
                  <div v-else>
                    <Button
                      @click="handleReviewResume()"
                      :disabled="isMatchingResume"
                    >
                      <Spinner v-if="isMatchingResume" />
                      Run review</Button
                    >
                  </div>
                </div>
              </DialogScrollContent>
            </Dialog>
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
              Swap
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
import { ref, computed } from "vue";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyIcon } from "@/components/ui/empty";
import {
  PhCheckFat,
  PhEnvelopeSimple,
  PhEnvelopeSimpleOpen,
  PhEye,
  PhFilePdf,
  PhPencilSimple,
  PhReadCvLogo,
  PhScales,
  PhSparkle,
  PhWarningCircle,
  PhXCircle,
} from "@phosphor-icons/vue";
import { Button } from "@/components/ui/button";
import { useCollection, useDocument } from "vuefire";
import { Resume, ResumeJobMatch } from "@/types";
import { collection, doc, limit, query, where } from "firebase/firestore";
import { db, functions } from "@/firebase/config.ts";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogScrollContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { httpsCallable } from "firebase/functions";
import { useCurrentUser } from "vuefire";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ResumeScore from "@/components/ResumeScore.vue";
import { Spinner } from "@/components/ui/spinner";

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

const user = useCurrentUser();

const isMatchingResume = ref(false);

const resumeRef = computed(() =>
  resumeId ? doc(collection(db, "userResumes"), resumeId) : null,
);
const resume = useDocument<Resume>(resumeRef);
const resumeJobMatchQuery = computed(() =>
  user.value
    ? query(
        collection(db, "resumeJobMatches"),
        where("userId", "==", user.value.uid),
        where("resumeId", "==", resumeId),
        where("jobApplicationId", "==", applicationId),
        limit(1),
      )
    : null,
);
const resumeJobMatches = useCollection<ResumeJobMatch>(resumeJobMatchQuery);
const resumeJobMatch = computed(() => resumeJobMatches.value[0] || null);

const matchResumeWithJobApplication = httpsCallable(
  functions,
  "matchResumeWithJobApplication",
);

async function handleReviewResume() {
  if (!resumeId || !applicationId) return;

  isMatchingResume.value = true;
  await matchResumeWithJobApplication({
    resumeId,
    applicationId,
  });
  isMatchingResume.value = false;
}
</script>
