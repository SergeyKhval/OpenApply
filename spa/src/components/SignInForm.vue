<template>
  <Card class="w-full max-w-md gap-2 border-0 bg-transparent py-0 shadow-none dark:border-0">
    <CardHeader class="px-0">
      <CardTitle
        ><h2 class="text-3xl font-extrabold mb-4">
          {{ pendingJob ? "Sign up to save this job" : "Sign in" }}
        </h2></CardTitle
      >
    </CardHeader>

    <CardContent class="px-0">
      <div class="mb-4">
        <Button
          @click="handleGoogleLogin"
          :disabled="loading"
          size="lg"
          class="w-full"
        >
          <PhGoogleLogo weight="bold" />
          {{ loading ? "Signing in…" : "Sign in with Google" }}
        </Button>
      </div>

      <div class="mb-4 flex items-center gap-3 text-sm text-muted-foreground" aria-hidden="true">
        <span class="h-px grow bg-border" />or<span class="h-px grow bg-border" />
      </div>

      <EmailCodeForm
        v-if="!usePassword"
        id-prefix="signin"
        :source="source"
        @signed-in="redirect()"
        @unavailable="fallBackToPassword"
      />

      <form v-else @submit.prevent="handleLogin" class="space-y-4">
        <p v-if="codesUnavailable" role="status" class="text-sm text-muted-foreground">
          Code sign-in isn't working right now. Sign in with your password instead.
        </p>

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

      <p class="mt-4 text-center text-sm">
        <button
          type="button"
          class="text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
          @click="togglePassword"
        >
          {{ usePassword ? "Email me a code instead" : "Use a password instead" }}
        </button>
      </p>

      <Alert v-if="error" variant="destructive" class="mt-4" role="alert">
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
import EmailCodeForm from "@/components/EmailCodeForm.vue";

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

// Accounts made before code sign-in keep their password as a fallback in
// case the code email is slow or lands in spam
const usePassword = ref(false);
const codesUnavailable = ref(false);
const email = ref("");
const password = ref("");
const loading = ref(false);
const showPassword = ref(false);
const error = ref("");
const errorCode = ref<string | undefined>(undefined);
const resettingPassword = ref(false);
const resetSent = ref(false);

const togglePassword = () => {
  usePassword.value = !usePassword.value;
  codesUnavailable.value = false;
  error.value = "";
  errorCode.value = undefined;
};

const fallBackToPassword = (address: string) => {
  email.value = address;
  usePassword.value = true;
  codesUnavailable.value = true;
};

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
