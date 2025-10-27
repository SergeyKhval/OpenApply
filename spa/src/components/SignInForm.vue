<template>
  <Card class="max-w-md w-full">
    <CardHeader>
      <CardTitle
        ><h2 class="text-2xl font-bold mb-6">
          Sign In
        </h2></CardTitle
      >
    </CardHeader>

    <CardContent>
      <form @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <Label class="block text-sm font-medium mb-1">Email</Label>
          <Input v-model="email" type="email" required class="w-full" />
        </div>

        <div>
          <Label class="block text-sm font-medium mb-1">Password</Label>
          <Input v-model="password" type="password" required class="w-full" />
        </div>

        <Button type="submit" :disabled="loading" class="w-full">
          {{ loading ? "Logging in..." : "Login" }}
        </Button>
      </form>

      <div class="mt-4">
        <Button
          variant="secondary"
          @click="handleGoogleLogin"
          :disabled="loading"
          class="w-full"
        >
          <PhGoogleLogo />
          {{ loading ? "Logging in..." : "Login with Google" }}
        </Button>
      </div>

      <div
        v-if="error"
        class="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded"
      >
        {{ error }}
      </div>

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
import { useRouter } from "vue-router";
import { PhGoogleLogo } from "@phosphor-icons/vue";
import { useAuth } from "@/composables/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type SignInFormEmits = {
  (event: "sign-up"): void;
};

const emit = defineEmits<SignInFormEmits>();

const router = useRouter();
const { login, loginWithGoogle } = useAuth();

const email = ref("");
const password = ref("");
const loading = ref(false);
const error = ref("");

const handleLogin = async () => {
  loading.value = true;
  error.value = "";

  const result = await login(email.value, password.value);

  if (result.success) {
    await router.push("/dashboard/applications");
  } else {
    error.value = result.error;
  }

  loading.value = false;
};

const handleGoogleLogin = async () => {
  loading.value = true;
  error.value = "";

  const result = await loginWithGoogle();

  if (result.success) {
    await router.push("/dashboard/applications");
  } else {
    error.value = result.error;
  }

  loading.value = false;
};
</script>
