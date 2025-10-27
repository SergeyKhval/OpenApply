<template>
  <Button
    v-if="coverLetterId"
    title="View cover letter"
    class="rounded-full size-12"
    variant="outline"
    size="icon"
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
    <PhEnvelopeSimpleOpen />
  </Button>
  <EmptyIcon
    v-else
    title="Generate cover letter"
    class="cursor-pointer hover:bg-input/50 size-12"
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
    <PhEnvelopeSimple />
  </EmptyIcon>
</template>

<script setup lang="ts">
import { PhEnvelopeSimple, PhEnvelopeSimpleOpen } from "@phosphor-icons/vue";
import { EmptyIcon } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";

type CoverLetterActionButtonProps = {
  applicationId?: string;
  coverLetterId?: string;
};

const { coverLetterId = "", applicationId = "" } =
  defineProps<CoverLetterActionButtonProps>();
</script>
