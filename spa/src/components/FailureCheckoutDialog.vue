<template>
  <Dialog :open="isOpen" @update:open="updateDialogOpenState">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Payment canceled!</DialogTitle>

        <div class="flex flex-col items-center">
          <PhXCircle size="96" class="text-destructive" />
          <p class="text-center text-lg mb-4">Your payment did not succeed!</p>

          <p class="text-2xl flex items-center gap-2">
            <PhCoins />
            {{ userProfile?.billingProfile?.currentBalance }}
          </p>
          <p class="text-muted-foreground mb-4">current coins balance</p>
          <p class="text-center">
            If you think this is an error on our side please reach out via
            <a
              :href="`mailto:${supportEmail}`"
              class="text-primary font-medium hover:underline"
            >
              email
            </a>
            or contact us on our
            <a
              href="https://discord.gg/VSPCrpbbZb"
              class="font-medium text-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer nofollow"
            >
              Discord server
            </a>
            .
          </p>
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
import {
  PhCoins,
  PhXCircle,
} from "@phosphor-icons/vue";
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

const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL;

function updateDialogOpenState(open: boolean) {
  if (!open) {
    router.replace({ query: omit(route.query, "dialog-name") });
  }
}
</script>
