<template>
  <SettingsShell>
    <Card>
      <CardHeader><CardTitle class="text-lg">Profile</CardTitle></CardHeader>
      <CardContent class="flex flex-col divide-y divide-border">
        <div class="flex items-center gap-3.5 pb-5">
          <Avatar class="size-14">
            <AvatarImage v-if="user?.photoURL" :src="user.photoURL" alt="" />
            <AvatarFallback class="bg-secondary text-xl font-extrabold text-secondary-foreground">{{ initials }}</AvatarFallback>
          </Avatar>
          <div class="flex min-w-0 flex-col gap-0.5">
            <span class="truncate text-lg font-bold">{{ user?.displayName || user?.email }}</span>
            <span class="truncate text-sm text-muted-foreground">
              <template v-if="user?.displayName">{{ user.email }} · </template>{{ plan }}
            </span>
          </div>
        </div>

        <form class="flex flex-col gap-2 py-5" @submit.prevent="saveName">
          <Label for="profile-name" class="text-[15px] font-semibold">Name</Label>
          <p id="profile-name-hint" class="text-sm text-muted-foreground">Used to greet you on your jobs board.</p>
          <div class="flex flex-col gap-2 sm:flex-row">
            <Input
              id="profile-name"
              v-model="nameInput"
              class="sm:max-w-sm"
              autocomplete="name"
              aria-describedby="profile-name-hint"
              :aria-invalid="!!error"
              :disabled="saving"
              @input="onEdit"
            />
            <Button type="submit" variant="outline" :disabled="!changed || saving">
              <Spinner v-if="saving" />
              Save
            </Button>
          </div>
          <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
          <p v-else-if="saved" role="status" class="text-sm text-muted-foreground">Saved.</p>
        </form>

        <div class="flex flex-col gap-0.5 pt-5">
          <p class="text-[15px] font-semibold">Email</p>
          <p class="truncate text-[15px]">{{ user?.email }}</p>
          <p class="text-sm text-muted-foreground">
            You sign in with this address. To change it, email
            <a href="mailto:support@openapply.app" class="font-semibold text-secondary-foreground underline-offset-2 hover:underline">support@openapply.app</a>.
          </p>
        </div>
      </CardContent>
    </Card>
  </SettingsShell>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { updateCurrentUserProfile, useCurrentUser } from "vuefire";
import SettingsShell from "@/components/settings/SettingsShell.vue";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useAiAllowance } from "@/composables/useAiAllowance";
import { useAuth } from "@/composables/useAuth";
import { initialsOf, planLabel } from "@/lib/account";
import { nameError, normalizeName } from "@/lib/profileName";

const user = useCurrentUser();
const { userProfile } = useAuth();
const { allowance } = useAiAllowance();

const initials = computed(() => initialsOf(user.value?.displayName, user.value?.email));
const plan = computed(() => planLabel(allowance.value?.plan, userProfile.value?.billingProfile));

const nameInput = ref("");
watch(
  () => user.value?.displayName,
  (current) => (nameInput.value = current ?? ""),
  { immediate: true },
);

const saving = ref(false);
const saved = ref(false);
const error = ref("");
const changed = computed(() => normalizeName(nameInput.value) !== (user.value?.displayName ?? ""));

function onEdit() {
  saved.value = false;
  error.value = "";
}

async function saveName() {
  const name = normalizeName(nameInput.value);
  const invalid = nameError(name);
  if (invalid) {
    error.value = invalid;
    return;
  }
  if (!changed.value || saving.value) return;
  saving.value = true;
  try {
    // An empty field removes the name; the greeting and avatar fall back to the email
    await updateCurrentUserProfile({ displayName: name || null });
    nameInput.value = name;
    saved.value = true;
  } catch {
    error.value = "Couldn't save your name. Try again.";
  } finally {
    saving.value = false;
  }
}
</script>

<route lang="yaml">
meta:
  requiresAuth: true
</route>
