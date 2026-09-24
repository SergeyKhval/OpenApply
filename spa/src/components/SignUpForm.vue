<template>
  <Card class="w-full max-w-md">
    <CardHeader>
      <CardTitle>
        <h2 class="text-2xl font-bold mb-6">{{ pendingJob ? "Sign up to save this job" : "Sign up" }}</h2>
      </CardTitle>
    </CardHeader>

    <CardContent>
      <div class="mb-4">
        <Button
          @click="handleGoogleLogin"
          :disabled="loading"
          class="w-full"
        >
          <PhGoogleLogo weight="bold" />
          {{ loading ? "Signing up…" : "Sign up with Google" }}
        </Button>
      </div>

      <div class="text-center text-sm text-muted-foreground mb-4">or</div>

      <EmailCodeForm id-prefix="signup" :source="source" @signed-in="redirect()" />

      <Alert v-if="error" variant="destructive" class="mt-4" role="alert">
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>

      <p class="mt-6 text-center text-sm">
        Already have an account?
        <button
          class="text-primary hover:underline cursor-pointer"
          @click="emit('sign-in')"
        >
          Sign in here
        </button>
      </p>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { PhGoogleLogo } from "@phosphor-icons/vue";
import { useAuth } from "@/composables/useAuth";
import { usePostAuthRedirect } from "@/composables/usePostAuthRedirect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import EmailCodeForm from "@/components/EmailCodeForm.vue";

type SignUpFormProps = {
  pendingJob?: boolean;
  source?: "landing_page_parse" | "resume_match_tool" | "extension" | "direct";
};

const { pendingJob = false, source = "direct" } = defineProps<SignUpFormProps>();

type SignUpFormEmits = {
  (event: "sign-in"): void;
};

const emit = defineEmits<SignUpFormEmits>();

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
