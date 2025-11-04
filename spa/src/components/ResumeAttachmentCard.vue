<template>
  <Empty class="sm:w-50 relative py-5 px-2 gap-4 border-solid">
    <ResumeScore
      v-if="resumeJobMatch"
      class="absolute top-2 right-2 size-8"
      :score="resumeJobMatch.matchResult.match_summary.overall_match_percent"
    />

    <EmptyIcon class="border-solid text-foreground border-foreground">
      <PhFilePdf :size="36" />
    </EmptyIcon>

    <ResumeLink
      :resume="resume"
      class="truncate max-w-full text-xs text-primary hover:underline"
    />

    <EmptyDescription class="text-foreground">
      <div class="items-center gap-2 flex">
        <Dialog>
          <DialogTrigger as-child>
            <Button size="sm" variant="outline">
              <PhScales />
              AI Review
            </Button>
          </DialogTrigger>

          <DialogScrollContent class="sm:max-w-200">
            <DialogHeader>
              <DialogTitle>
                {{
                  resumeJobMatch
                    ? "Your personalized match is ready"
                    : "Get your personalized match in seconds"
                }}
              </DialogTitle>
              <DialogDescription>
                {{
                  resumeJobMatch
                    ? ""
                    : "Run a quick AI review to see your match score and targeted suggestions to strengthen this application."
                }}
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
                    <TabsTrigger value="recommendations">
                      Recommendations
                    </TabsTrigger>
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
                  <TabsContent value="skills" class="max-h-75 overflow-y-auto">
                    <table class="text-xs">
                      <thead>
                        <tr class="text-left">
                          <th></th>
                          <th class="pr-2 min-w-35">Required skill for job</th>
                          <th>Evidence from your resume</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-border">
                        <tr
                          v-for="skill in resumeJobMatch.matchResult
                            .skills_comparison.missing_skills"
                          :key="skill.skill"
                        >
                          <td
                            class="pr-2 py-2 align-top"
                            title="You miss this skill"
                          >
                            <PhXCircle
                              size="16"
                              class="text-destructive shrink-0"
                            />
                          </td>
                          <td class="py-2 pr-2 align-top">
                            {{ skill.skill }}
                          </td>
                          <td class="py-2 pr-2 italic leading-5 align-top">
                            {{ skill.evidence || "N/A" }}
                          </td>
                        </tr>
                        <tr
                          v-for="skill in resumeJobMatch.matchResult
                            .skills_comparison.partially_matched_skills"
                          :key="skill.skill"
                        >
                          <td
                            class="pr-2 align-top py-2"
                            title="Partially matched skill"
                          >
                            <PhWarningCircle
                              size="16"
                              class="shrink-0 text-yellow-500"
                            />
                          </td>
                          <td class="py-2 pr-2 align-top">
                            {{ skill.skill }}
                          </td>

                          <td class="py-2 pr-2 italic leading-5 align-top">
                            {{ skill.evidence }}
                          </td>
                        </tr>
                        <tr
                          v-for="skill in resumeJobMatch.matchResult
                            .skills_comparison.matched_skills"
                          :key="skill.skill"
                        >
                          <td
                            class="pr-2 py-2 align-top"
                            title="Fully matched skill"
                          >
                            <PhCheckFat
                              size="16"
                              weight="fill"
                              class="text-emerald-600"
                            />
                          </td>
                          <td class="py-2 pr-2 align-top">{{ skill.skill }}</td>
                          <td class="py-2 pr-2 leading-5 italic align-top">
                            {{ skill.evidence }}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </TabsContent>
                </Tabs>
              </div>
              <div v-else-if="isMatchingResume">
                <div
                  class="flex flex-col items-center justify-center space-y-4 my-10"
                >
                  <PhSpinner size="64" class="animate-spin" />

                  <p class="text-center text-sm text-foreground-muted">
                    Reviewing your resume against the job application... <br />
                    This may take up to a minute.
                  </p>
                </div>
              </div>
              <div v-else>
                <AvailableCoins
                  :current-balance="currentBalance"
                  cost-text="10 coins per AI review"
                  class="mb-6"
                />

                <div v-if="!hasSufficientCredits" class="space-y-6">
                  <div
                    class="rounded-lg border border-border bg-muted/10 p-6 space-y-2"
                  >
                    <p class="text-lg font-semibold">
                      Add more coins to continue
                    </p>
                    <p class="text-sm text-muted-foreground">
                      You need at least {{ requiredCredits }} coins to generate
                      an AI resume review. Choose a pack below to keep going.
                    </p>
                  </div>
                  <CreditPackOptions
                    :loading="generatingStripeLink"
                    @purchase="startCheckout"
                  />
                </div>

                <div v-else class="flex flex-col">
                  <ul
                    class="text-sm list-disc list-inside space-y-1 text-left mb-6"
                  >
                    <li>Overall match score</li>
                    <li>Top strengths recruiters will notice</li>
                    <li>Missing or weak skills to address</li>
                    <li>Specific edits to boost your chances</li>
                  </ul>

                  <!-- Error Message -->
                  <Alert v-if="errorMessage" variant="destructive" class="mb-4">
                    <PhWarningCircle />
                    <AlertDescription>
                      {{ errorMessage }}
                    </AlertDescription>
                  </Alert>

                  <div class="flex flex-col items-start gap-2">
                    <template v-if="applicationHasDescription">
                      <Button
                        :disabled="!applicationHasDescription"
                        @click="handleReviewResume()"
                      >
                        Run review
                      </Button>
                      <p class="text-xs text-muted-foreground">
                        Takes under a minute. You can re‑run after updating your
                        resume.
                      </p>
                    </template>
                    <Alert v-else variant="destructive">
                      <PhWarningCircle />
                      <AlertDescription>
                        This job application does not have a description. Please
                        add one to unlock AI resume reviews.
                      </AlertDescription>
                    </Alert>
                  </div>
                </div>
              </div>
            </div>
          </DialogScrollContent>
        </Dialog>
      </div>
    </EmptyDescription>
  </Empty>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import {
  PhCheckFat,
  PhFilePdf,
  PhScales,
  PhSpinner,
  PhWarningCircle,
  PhXCircle,
} from "@phosphor-icons/vue";
import { Button } from "@/components/ui/button";
import { collection, limit, query, where } from "firebase/firestore";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogScrollContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyIcon } from "@/components/ui/empty";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ResumeScore from "@/components/ResumeScore.vue";
import { db, functions } from "@/firebase/config.ts";
import { useCollection, useCurrentUser } from "vuefire";
import { Resume, ResumeJobMatch } from "@/types";
import { httpsCallable } from "firebase/functions";
import ResumeLink from "@/components/ResumeLink.vue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/composables/useAuth";
import { useCreditsCheckout } from "@/composables/useCreditsCheckout";
import CreditPackOptions from "@/components/CreditPackOptions.vue";
import AvailableCoins from "@/components/AvailableCoins.vue";

type ResumeAttachmentCardProps = {
  resume: Resume;
  applicationId: string;
  applicationHasDescription?: boolean;
};

const {
  resume,
  applicationId,
  applicationHasDescription = false,
} = defineProps<ResumeAttachmentCardProps>();

const user = useCurrentUser();
const { userProfile } = useAuth();
const { startCheckout, isProcessing: generatingStripeLink } =
  useCreditsCheckout();

const isMatchingResume = ref(false);
const errorMessage = ref("");

const requiredCredits = 10;

const currentBalance = computed(
  () => userProfile.value?.billingProfile?.currentBalance ?? 0,
);

const hasSufficientCredits = computed(
  () => currentBalance.value >= requiredCredits,
);

const matchResumeWithJobApplication = httpsCallable(
  functions,
  "matchResumeWithJobApplication",
);

async function handleReviewResume() {
  if (!resume.id || !applicationId) return;

  isMatchingResume.value = true;
  errorMessage.value = "";

  try {
    await matchResumeWithJobApplication({
      resumeId: resume.id,
      applicationId,
    });
  } catch (err: unknown) {
    console.error("Error generating resume review:", err);

    const maybeError = err as {
      code?: string;
      message?: string;
      details?: { code?: string };
    };

    // Check for insufficient credits error
    const errorCode =
      maybeError.code?.replace("functions/", "") ||
      (maybeError.details as { code?: string })?.code;

    if (errorCode !== "insufficient-credits") {
      errorMessage.value =
        maybeError.message || "Failed to generate AI resume review";
    }
  } finally {
    isMatchingResume.value = false;
  }
}

const resumeJobMatchQuery = computed(() =>
  user.value && resume && applicationId
    ? query(
        collection(db, "resumeJobMatches"),
        where("userId", "==", user.value.uid),
        where("resumeId", "==", resume.id),
        where("jobApplicationId", "==", applicationId),
        limit(1),
      )
    : null,
);
const resumeJobMatches = useCollection<ResumeJobMatch>(resumeJobMatchQuery);
const resumeJobMatch = computed(() => resumeJobMatches.value[0] || null);
</script>
