<template>
  <Card class="w-full max-w-md gap-2 border-0 bg-transparent py-0 shadow-none dark:border-0">
    <CardHeader class="px-0">
      <CardTitle>
        <h2 class="text-3xl font-extrabold mb-4">{{ pendingJob ? "Sign up to save this job" : "Sign up" }}</h2>
      </CardTitle>
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
          {{ loading ? "Signing up…" : "Sign up with Google" }}
        </Button>
      </div>

      <div class="mb-4 flex items-center gap-3 text-sm text-muted-foreground" aria-hidden="true">
        <span class="h-px grow bg-border" />or<span class="h-px grow bg-border" />
      </div>

      <EmailCodeForm
        v-if="!usePassword"
        id-prefix="signup"
        :source="source"
        @signed-in="redirect()"
        @unavailable="fallBackToPassword"
      />

      <form v-else @submit.prevent="handleSignUp" class="flex flex-col gap-4">
        <p v-if="codesUnavailable" role="status" class="text-sm text-muted-foreground">
          Code sign-in isn't working right now. Choose a password instead.
        </p>

        <div>
          <Label for="signup-email" class="text-sm mb-1">Email</Label>
          <Input
            id="signup-email"
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
          <Label for="signup-password" class="text-sm mb-1">Password</Label>
          <div class="relative">
            <Input
              id="signup-password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              name="new-password"
              autocomplete="new-password"
              minlength="6"
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
          <p class="text-xs text-muted-foreground mt-1">At least 6 characters</p>
        </div>

        <Button type="submit" :disabled="loading" variant="outline" class="w-full">
          {{ loading ? "Signing up…" : "Sign up" }}
        </Button>
      </form>

      <p class="mt-4 text-center text-sm">
        <button
          type="button"
          class="text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
          @click="togglePassword"
        >
          {{ usePassword ? "Email me a code instead" : "Sign up with a password instead" }}
        </button>
      </p>

      <Alert v-if="error" variant="destructive" class="mt-4" role="alert">
        <AlertDescription>
          {{ error }}
          <button
            v-if="errorCode === 'auth/email-already-in-use'"
            type="button"
            class="ml-1 underline hover:no-underline cursor-pointer"
            @click="emit('sign-in')"
          >
            Sign in instead
          </button>
        </AlertDescription>
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
import { PhEye, PhEyeSlash, PhGoogleLogo } from "@phosphor-icons/vue";
import { useAuth } from "@/composables/useAuth";
import { usePostAuthRedirect } from "@/composables/usePostAuthRedirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
const { register, loginWithGoogle } = useAuth();

// Password sign-up stays reachable until code sign-in is proven in
// production, and takes over automatically if the code service is down
const usePassword = ref(false);
const codesUnavailable = ref(false);
const email = ref("");
const password = ref("");
const loading = ref(false);
const showPassword = ref(false);
const error = ref("");
const errorCode = ref<string | undefined>(undefined);

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

async function handleSignUp() {
  loading.value = true;
  error.value = "";
  errorCode.value = undefined;

  const result = await register(email.value, password.value, { source });

  if (result.success) {
    redirect();
  } else {
    error.value = result.error;
    errorCode.value = result.code;
  }

  loading.value = false;
}
</script>
