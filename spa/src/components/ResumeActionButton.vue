<template>
  <Button
    v-if="resumeId"
    class="rounded-full size-12"
    title="View resume"
    variant="outline"
    size="icon"
    @click="openResumePicker"
  >
    <PhFilePdf />
  </Button>
  <EmptyIcon
    v-else
    title="Attach resume"
    class="cursor-pointer hover:bg-input/50 size-12"
    @click="openResumePicker"
  >
    <PhReadCvLogo />
  </EmptyIcon>
</template>

<script setup lang="ts">
import { PhFilePdf, PhReadCvLogo } from "@phosphor-icons/vue";
import { EmptyIcon } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { useRouter, useRoute } from "vue-router";

type ResumeActionButtonProps = {
  applicationId: string;
  resumeId?: string | null;
};

const { resumeId = "", applicationId } = defineProps<ResumeActionButtonProps>();

const router = useRouter();
const route = useRoute();

const openResumePicker = () => {
  router.replace({
    query: {
      ...route.query,
      "dialog-name": "resume-picker",
      "application-id": applicationId,
      "resume-id": resumeId,
    },
  });
};
</script>
