<template>
  <Card class="w-full max-w-md">
    <CardHeader>
      <CardTitle>
        <h2 class="text-2xl font-bold mb-6">Sign Up</h2>
      </CardTitle>
    </CardHeader>

    <CardContent>
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
import { useRouter } from "vue-router";
import { useAuth } from "../composables/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type SignUpFormEmits = {
  (event: "sign-in"): void;
};

const emit = defineEmits<SignUpFormEmits>();

const router = useRouter();
const { register } = useAuth();

const email = ref("");
const password = ref("");
const loading = ref(false);
const error = ref("");

async function handleSignUp() {
  loading.value = true;
  error.value = "";

  const result = await register(email.value, password.value);

  if (result.success) {
    await router.push("/dashboard/applications");
  } else {
    error.value = result.error;
  }

  loading.value = false;
}
</script>
