<template>
  <Dialog :open="isOpen" @update:open="updateDialogOpenState">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Checkout canceled</DialogTitle>

        <div class="flex flex-col items-center">
          <PhXCircle size="96" class="text-destructive" />
          <p class="text-center text-lg mb-4">You weren't charged.</p>

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
import { PhXCircle } from "@phosphor-icons/vue";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { omit } from "lodash";
import { useRoute, useRouter } from "vue-router";

type SuccessCheckoutDialogProps = {
  isOpen: boolean;
};

const { isOpen } = defineProps<SuccessCheckoutDialogProps>();

const router = useRouter();
const route = useRoute();

const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL;

function updateDialogOpenState(open: boolean) {
  if (!open) {
    router.replace({ query: omit(route.query, "dialog-name") });
  }
}
</script>
