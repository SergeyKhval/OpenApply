<template>
  <Dialog :open="isOpen" @update:open="updateDialogOpenState">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Payment successful!</DialogTitle>

        <div class="flex flex-col items-center">
          <PhSealCheck size="96" class="text-green-400" />
          <p class="text-center text-lg mb-4">Thanks for your purchase!</p>

          <p class="text-2xl flex items-center gap-2">
            <PhCoins />
            {{ userProfile?.billingProfile?.currentBalance }}
          </p>
          <p class="text-muted-foreground mb-4">current coins balance</p>
          <p>Good luck in your job search!</p>
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
import { PhCoins, PhSealCheck } from "@phosphor-icons/vue";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { omit } from "lodash";
import { useAuth } from "@/composables/useAuth.ts";
import { useRoute, useRouter } from "vue-router";

type SuccessCheckoutDialogProps = {
  isOpen: boolean;
};

const { isOpen } = defineProps<SuccessCheckoutDialogProps>();

const router = useRouter();
const route = useRoute();
const { userProfile } = useAuth();

function updateDialogOpenState(open: boolean) {
  if (!open) {
    router.replace({ query: omit(route.query, "dialog-name") });
  }
}
</script>
