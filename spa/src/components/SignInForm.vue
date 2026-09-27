<template>
  <div class="flex w-full max-w-md flex-col gap-5">
    <div class="flex flex-col gap-1.5">
      <h2 class="text-[28px] font-extrabold leading-tight lg:text-[34px]">Sign in</h2>
      <p class="text-[15px] text-soft-foreground">Welcome back. Pick up where you left off.</p>
    </div>

    <Button variant="outline" size="lg" class="w-full" :disabled="loading" @click="handleGoogleLogin">
      <span class="grid size-5 place-items-center rounded-full border border-border bg-card">
        <PhGoogleLogo weight="bold" class="size-3" />
      </span>
      {{ loading ? "Opening Google…" : "Continue with Google" }}
    </Button>

    <div class="flex items-center gap-3 text-sm text-muted-foreground" aria-hidden="true">
      <span class="h-px grow bg-border" />or<span class="h-px grow bg-border" />
    </div>

    <EmailCodeForm
      id-prefix="signin"
      :source="source"
      @signed-in="redirect()"
      @google="handleGoogleLogin"
    />

    <Alert v-if="error" variant="destructive" role="alert">
      <AlertDescription>{{ error }}</AlertDescription>
    </Alert>

    <div class="flex flex-col gap-2 text-[13px] text-muted-foreground">
      <p>No password. New or returning, it is the same step.</p>
      <p>
        By continuing you agree to the
        <a href="/terms" class="underline underline-offset-2 hover:text-foreground">Terms</a> and
        <a href="/privacy" class="underline underline-offset-2 hover:text-foreground">Privacy policy</a>.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { PhGoogleLogo } from "@phosphor-icons/vue";
import { useAuth } from "@/composables/useAuth";
import { usePostAuthRedirect } from "@/composables/usePostAuthRedirect";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import EmailCodeForm from "@/components/EmailCodeForm.vue";

type SignInFormProps = {
  pendingJob?: boolean;
  source?: "landing_page_parse" | "resume_match_tool" | "extension" | "direct";
};

const { source = "direct" } = defineProps<SignInFormProps>();

const { redirect } = usePostAuthRedirect();
const { loginWithGoogle } = useAuth();

const loading = ref(false);
const error = ref("");

const handleGoogleLogin = async () => {
  loading.value = true;
  error.value = "";

  const result = await loginWithGoogle({ source });

  if (result.success) {
    redirect();
  } else {
    error.value = result.error;
  }

  loading.value = false;
};
</script>
