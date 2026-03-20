<template>
  <Card class="w-full max-w-md">
    <CardHeader>
      <CardTitle>
        <h2 class="text-2xl font-bold mb-6">{{ pendingJob ? "Sign up to save this job" : "Sign Up" }}</h2>
      </CardTitle>
    </CardHeader>

    <CardContent>
      <div class="mb-4">
        <Button
          variant="secondary"
          @click="handleGoogleLogin"
          :disabled="loading"
          class="w-full"
        >
          <PhGoogleLogo />
          {{ loading ? "Signing up..." : "Sign up with Google" }}
        </Button>
      </div>

      <div class="text-center text-sm text-muted-foreground mb-4">or</div>

      <form @submit.prevent="handleSignUp" class="flex flex-col gap-4">
        <div>
          <Label class="text-sm mb-1"
            >Email</Label
          >
          <Input v-model="email" type="email" required class="w-full" />
        </div>

        <div>
          <Label class="text-sm mb-1"
            >Password</Label
          >
          <Input v-model="password" type="password" required class="w-full" />
        </div>

        <Button type="submit" :disabled="loading" class="w-full">
          {{ loading ? "Signing up..." : "Sign Up" }}
        </Button>
      </form>

      <div
        v-if="error"
        class="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded"
      >
        {{ error }}
      </div>

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
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type SignUpFormProps = {
  pendingJob?: boolean;
  source?: "landing_page_parse" | "direct";
};

const { pendingJob = false, source = "direct" } = defineProps<SignUpFormProps>();

type SignUpFormEmits = {
  (event: "sign-in"): void;
};

const emit = defineEmits<SignUpFormEmits>();

const { redirect } = usePostAuthRedirect();
const { register, loginWithGoogle } = useAuth();

const email = ref("");
const password = ref("");
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

async function handleSignUp() {
  loading.value = true;
  error.value = "";

  const result = await register(email.value, password.value, { source });

  if (result.success) {
    redirect();
  } else {
    error.value = result.error;
  }

  loading.value = false;
}
</script>
