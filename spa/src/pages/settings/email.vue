<template>
  <SettingsShell>
    <Card>
      <CardHeader><CardTitle class="text-lg">Email</CardTitle></CardHeader>
      <CardContent>
        <div class="flex items-center justify-between gap-6">
          <div class="flex flex-col gap-0.5">
            <Label for="weekly-digest" class="text-[15px] font-semibold">Monday summary</Label>
            <p class="text-sm text-muted-foreground">Follow-ups due and interviews this week, every Monday morning.</p>
          </div>
          <Switch
            id="weekly-digest"
            :model-value="weeklyDigest"
            :disabled="saving || !profileLoaded"
            @update:model-value="save"
          />
        </div>
        <p v-if="error" role="alert" class="mt-3 text-sm text-destructive">{{ error }}</p>
      </CardContent>
    </Card>
  </SettingsShell>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useCurrentUser, useDocument } from "vuefire";
import { doc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/firebase/config";
import SettingsShell from "@/components/settings/SettingsShell.vue";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type UserProfile = { emailPrefs?: { weeklyDigest?: boolean } };

const user = useCurrentUser();
const { data: profile, pending } = useDocument<UserProfile>(
  computed(() => (user.value ? doc(db, "users", user.value.uid) : null)),
);
const profileLoaded = computed(() => !pending.value);

// On unless turned off (same rule as the digest function)
const optimistic = ref<boolean | null>(null);
const weeklyDigest = computed(
  () => optimistic.value ?? profile.value?.emailPrefs?.weeklyDigest !== false,
);

const saving = ref(false);
const error = ref("");

async function save(value: boolean) {
  optimistic.value = value;
  saving.value = true;
  error.value = "";
  try {
    await httpsCallable(functions, "setEmailPreferences")({ weeklyDigest: value });
  } catch {
    optimistic.value = null;
    error.value = "Couldn't save that. Try again.";
  } finally {
    saving.value = false;
  }
}
</script>

<route lang="yaml">
meta:
  requiresAuth: true
</route>
