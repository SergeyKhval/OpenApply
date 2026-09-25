<template>
  <SettingsShell>
    <Card>
      <CardHeader><CardTitle class="text-lg">Account</CardTitle></CardHeader>
      <CardContent class="flex flex-col divide-y divide-border">
        <div class="flex flex-col gap-4 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex min-w-0 flex-col gap-0.5">
            <p class="truncate text-[15px] font-semibold">{{ user?.email }}</p>
            <p class="text-sm text-muted-foreground">{{ signInMethod }}</p>
          </div>
          <Button variant="outline" size="sm" @click="signOut">
            <PhSignOut />
            Sign out
          </Button>
        </div>
        <div class="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex flex-col gap-0.5">
            <p class="text-[15px] font-semibold">Delete account and all data</p>
            <p class="text-sm text-muted-foreground">Jobs, documents and AI results. This cannot be undone.</p>
          </div>
          <Button variant="destructive" size="sm" @click="dialogOpen = true">
            <PhTrash />
            Delete…
          </Button>
        </div>
      </CardContent>
    </Card>

    <Dialog v-model:open="dialogOpen" @update:open="onOpenChange">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete your account?</DialogTitle>
          <DialogDescription>
            This removes every job, note, contact, interview, resume, cover letter and AI result, then your sign-in.
            It cannot be undone.
            <RouterLink to="/settings/import-export" class="font-semibold text-secondary-foreground underline-offset-2 hover:underline">
              Export your jobs first
            </RouterLink>
            if you want a copy.
          </DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="deleteEverything">
          <div class="flex flex-col gap-2">
            <Label for="delete-confirm">Type DELETE to confirm</Label>
            <Input
              id="delete-confirm"
              v-model="confirmText"
              autocomplete="off"
              autocapitalize="characters"
              spellcheck="false"
              :disabled="deleting"
            />
          </div>
          <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
          <DialogFooter class="gap-2">
            <Button type="button" variant="ghost" :disabled="deleting" @click="dialogOpen = false">Cancel</Button>
            <Button type="submit" variant="destructive" :disabled="!confirmed || deleting">
              <Spinner v-if="deleting" />
              Delete everything
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </SettingsShell>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useCurrentUser } from "vuefire";
import { httpsCallable } from "firebase/functions";
import { PhSignOut, PhTrash } from "@phosphor-icons/vue";
import { functions } from "@/firebase/config";
import { trackEvent } from "@/analytics";
import { useAuth } from "@/composables/useAuth";
import { signInMethodLabel } from "@/lib/signInMethod";
import SettingsShell from "@/components/settings/SettingsShell.vue";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

const user = useCurrentUser();
const { logout } = useAuth();
const router = useRouter();

const signInMethod = computed(() =>
  signInMethodLabel((user.value?.providerData ?? []).map((provider) => provider.providerId)),
);

async function signOut() {
  const result = await logout();
  if (result.success) await router.push("/");
}

const dialogOpen = ref(false);
const confirmText = ref("");
const deleting = ref(false);
const error = ref("");
const confirmed = computed(() => confirmText.value.trim() === "DELETE");

function onOpenChange(open: boolean) {
  if (open) return;
  confirmText.value = "";
  error.value = "";
}

async function deleteEverything() {
  if (!confirmed.value || deleting.value) return;
  deleting.value = true;
  error.value = "";
  try {
    await httpsCallable(functions, "deleteAccount", { timeout: 300_000 })({ confirm: "DELETE" });
    trackEvent("account_deleted");
    await logout();
    await router.push("/");
  } catch (err) {
    const code = (err as { code?: string }).code;
    error.value =
      code === "functions/failed-precondition"
        ? (err as Error).message
        : "Couldn't finish deleting your account. Try again, or email support@openapply.app.";
    deleting.value = false;
  }
}
</script>

<route lang="yaml">
meta:
  requiresAuth: true
</route>
