<template>
  <Card class="max-w-md w-full">
    <CardHeader>
      <CardTitle
        ><h2 class="text-2xl font-bold mb-6">
          {{ pendingJob ? "Sign up to save this job" : "Sign in" }}
        </h2></CardTitle
      >
    </CardHeader>

    <CardContent>
      <div class="mb-4">
        <Button
          @click="handleGoogleLogin"
          :disabled="loading"
          class="w-full"
        >
          <PhGoogleLogo weight="bold" />
          {{ loading ? "Signing in…" : "Sign in with Google" }}
        </Button>
      </div>

      <div class="text-center text-sm text-muted-foreground mb-4">or</div>

      <form @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <Label for="signin-email" class="block text-sm font-medium mb-1">Email</Label>
          <Input
            id="signin-email"
            v-model="email"
            type="email"
            name="email"
            autocomplete="email"
            spellcheck="false"
            required
            class="w-full"
          />
        </div>

        <div>
          <Label for="signin-password" class="block text-sm font-medium mb-1">Password</Label>
          <div class="relative">
            <Input
              id="signin-password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              name="password"
              autocomplete="current-password"
              required
              class="w-full pr-10"
            />
            <button
              type="button"
              class="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
              :aria-label="showPassword ? 'Hide password' : 'Show password'"
              @click="showPassword = !showPassword"
            >
              <PhEyeSlash v-if="showPassword" :size="18" />
              <PhEye v-else :size="18" />
            </button>
          </div>
        </div>

        <Button type="submit" :disabled="loading" variant="outline" class="w-full">
          {{ loading ? "Signing in…" : "Sign in" }}
        </Button>
      </form>

      <Alert v-if="error" variant="destructive" class="mt-4">
        <AlertDescription>
          {{ error }}
          <button
            v-if="errorCode === 'auth/invalid-credential' || errorCode === 'auth/wrong-password' || errorCode === 'auth/user-not-found'"
            type="button"
            class="ml-1 underline hover:no-underline cursor-pointer"
            :disabled="resettingPassword"
            @click="handleResetPassword"
          >
            {{ resetSent ? "Reset email sent" : "Reset password?" }}
          </button>
        </AlertDescription>
      </Alert>

      <p class="mt-6 text-center text-sm text-foreground">
        Don't have an account?
        <button
          class="text-primary hover:underline cursor-pointer"
          @click="emit('sign-up')"
        >
          Sign up here
        </button>
      </p>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { PhEye, PhEyeSlash, PhGoogleLogo } from "@phosphor-icons/vue";
import { useAuth } from "@/composables/useAuth";
import { usePostAuthRedirect } from "@/composables/usePostAuthRedirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

type SignInFormProps = {
  pendingJob?: boolean;
  source?: "landing_page_parse" | "resume_match_tool" | "extension" | "direct";
};

const { pendingJob = false, source = "direct" } = defineProps<SignInFormProps>();

type SignInFormEmits = {
  (event: "sign-up"): void;
};

const emit = defineEmits<SignInFormEmits>();

const { redirect } = usePostAuthRedirect();
const { login, loginWithGoogle, resetPassword } = useAuth();

const email = ref("");
const password = ref("");
const loading = ref(false);
const showPassword = ref(false);
const error = ref("");
const errorCode = ref<string | undefined>(undefined);
const resettingPassword = ref(false);
const resetSent = ref(false);

const handleLogin = async () => {
  loading.value = true;
  error.value = "";
  errorCode.value = undefined;
  resetSent.value = false;

  const result = await login(email.value, password.value, { source });

  if (result.success) {
    redirect();
  } else {
    error.value = result.error;
    errorCode.value = result.code;
  }

  loading.value = false;
};

const handleGoogleLogin = async () => {
  loading.value = true;
  error.value = "";
  errorCode.value = undefined;

  const result = await loginWithGoogle({ source });

  if (result.success) {
    redirect();
  } else {
    error.value = result.error;
    errorCode.value = result.code;
  }

  loading.value = false;
};

const handleResetPassword = async () => {
  if (!email.value) {
    error.value = "Enter your email above first.";
    errorCode.value = undefined;
    return;
  }
  resettingPassword.value = true;
  const result = await resetPassword(email.value);
  resettingPassword.value = false;
  if (result.success) {
    resetSent.value = true;
  } else {
    error.value = result.error;
    errorCode.value = undefined;
  }
};
</script>
