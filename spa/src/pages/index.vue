<template>
  <div class="min-h-screen bg-background p-8 flex items-center justify-around">
    <div v-if="!userLoaded" class="flex flex-col items-center gap-4">
      <div
        class="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin"
        aria-hidden="true"
      />
      <p class="text-lg font-semibold text-foreground">Loading...</p>
    </div>
    <template v-else-if="!user">
      <SignInForm
        v-if="viewMode === 'sign-in'"
        @sign-up="viewMode = 'sign-up'"
      />
      <SignUpForm v-else @sign-in="viewMode = 'sign-in'" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import SignInForm from "@/components/SignInForm.vue";
import SignUpForm from "@/components/SignUpForm.vue";
import { useCurrentUser, useIsCurrentUserLoaded } from "vuefire";
import { useRouter } from "vue-router";

const router = useRouter();

const user = useCurrentUser();
const userLoaded = useIsCurrentUserLoaded();

const viewMode = ref<"sign-in" | "sign-up">("sign-in");

watch(user, (newUser) => {
  if (newUser) {
    router.push("/dashboard/applications");
  }
});
</script>
