<template>
  <Dialog :open="isOpen" @update:open="updateDialogOpenState">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ isPro ? "Welcome to Pro" : "Payment received" }}</DialogTitle>

        <div class="flex flex-col items-center gap-2 py-4">
          <template v-if="isPro">
            <PhSealCheck size="96" class="text-green-400" />
            <p class="text-center text-lg">You now have 150 AI checks a month.</p>
            <p class="text-center text-muted-foreground">
              Manage or cancel anytime from your account menu.
            </p>
          </template>
          <template v-else>
            <Spinner class="size-12" />
            <p class="text-center text-lg">Activating your plan…</p>
            <p class="text-center text-muted-foreground">
              This usually takes a few seconds.
            </p>
          </template>
        </div>
      </DialogHeader>

      <DialogFooter>
        <Button variant="secondary" @click="updateDialogOpenState(false)"
          >Close</Button
        >
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { computed } from "vue";
import { PhSealCheck } from "@phosphor-icons/vue";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { omit } from "lodash";
import { useAiAllowance } from "@/composables/useAiAllowance";
import { useRoute, useRouter } from "vue-router";

type SuccessCheckoutDialogProps = {
  isOpen: boolean;
};

const { isOpen } = defineProps<SuccessCheckoutDialogProps>();

const router = useRouter();
const route = useRoute();
const { allowance } = useAiAllowance();
const isPro = computed(() => allowance.value?.plan === "pro");

function updateDialogOpenState(open: boolean) {
  if (!open) {
    router.replace({ query: omit(route.query, "dialog-name") });
  }
}
</script>
