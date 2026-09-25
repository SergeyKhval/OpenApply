<template>
  <form v-if="step === 'email'" class="space-y-4" @submit.prevent="handleSendCode">
    <div>
      <Label :for="`${idPrefix}-email`" class="block text-sm font-medium mb-1">Email</Label>
      <Input
        :id="`${idPrefix}-email`"
        v-model="email"
        type="email"
        name="email"
        autocomplete="email"
        spellcheck="false"
        required
        class="w-full"
      />
    </div>

    <Button type="submit" :disabled="loading" variant="outline" size="lg" class="w-full">
      {{ loading ? "Sending…" : "Email me a code" }}
    </Button>
  </form>

  <form v-else class="space-y-4" @submit.prevent="handleVerifyCode">
    <p class="text-sm text-foreground">
      We sent a 6-digit code to <strong class="break-words">{{ sentTo }}</strong>. It expires in 10 minutes.
    </p>

    <div>
      <Label :for="`${idPrefix}-code`" class="block text-sm font-medium mb-1">Code</Label>
      <Input
        :id="`${idPrefix}-code`"
        ref="codeInput"
        v-model="code"
        type="text"
        name="code"
        inputmode="numeric"
        autocomplete="one-time-code"
        maxlength="7"
        required
        class="h-16 w-full text-center font-display text-3xl font-bold tracking-[0.45em]"
      />
    </div>

    <Button type="submit" :disabled="loading" size="lg" class="w-full">
      {{ loading ? "Checking…" : "Continue" }}
    </Button>

    <div class="flex items-center justify-between text-sm">
      <button
        type="button"
        class="text-primary hover:underline cursor-pointer"
        @click="useDifferentEmail"
      >
        Use a different email
      </button>
      <button
        type="button"
        class="text-primary hover:underline cursor-pointer disabled:text-muted-foreground disabled:no-underline disabled:cursor-default"
        :disabled="loading || resendCooldown > 0"
        @click="handleResend"
      >
        {{ resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : "Resend code" }}
      </button>
    </div>
    <p class="text-xs text-muted-foreground">Can't find it? Check your spam folder.</p>
  </form>

  <Alert v-if="error" variant="destructive" class="mt-4" role="alert">
    <AlertDescription>{{ error }}</AlertDescription>
  </Alert>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from "vue";
import { useAuth } from "@/composables/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

type EmailCodeFormProps = {
  source?: "landing_page_parse" | "resume_match_tool" | "extension" | "direct";
  idPrefix?: string;
};

const { source = "direct", idPrefix = "email-code" } = defineProps<EmailCodeFormProps>();

type EmailCodeFormEmits = {
  (event: "signed-in"): void;
  // The code service is down or not deployed; the parent offers a password
  (event: "unavailable", email: string): void;
};

const emit = defineEmits<EmailCodeFormEmits>();

const RESEND_COOLDOWN_SECONDS = 30;
// Failures that mean the code flow itself is broken (function missing, email
// provider or token signing failing), not a wrong code or a rate limit
const SERVICE_DOWN_CODES = new Set(["functions/not-found", "functions/internal", "functions/unavailable"]);

const { sendSignInCode, verifySignInCode } = useAuth();

const step = ref<"email" | "code">("email");
const email = ref("");
const sentTo = ref("");
const code = ref("");
const loading = ref(false);
const error = ref("");
const resendCooldown = ref(0);
const codeInput = ref<{ $el?: HTMLInputElement } | null>(null);
let cooldownTimer: ReturnType<typeof setInterval> | undefined;

function startCooldown() {
  clearInterval(cooldownTimer);
  resendCooldown.value = RESEND_COOLDOWN_SECONDS;
  cooldownTimer = setInterval(() => {
    resendCooldown.value -= 1;
    if (resendCooldown.value <= 0) clearInterval(cooldownTimer);
  }, 1000);
}

onBeforeUnmount(() => clearInterval(cooldownTimer));

async function sendCode(address: string) {
  loading.value = true;
  error.value = "";
  const result = await sendSignInCode(address);
  loading.value = false;
  if (!result.success) {
    if (result.code && SERVICE_DOWN_CODES.has(result.code)) {
      emit("unavailable", address);
    } else {
      error.value = result.error;
    }
    return false;
  }
  startCooldown();
  return true;
}

async function handleSendCode() {
  const address = email.value.trim();
  if (!(await sendCode(address))) return;
  sentTo.value = address;
  code.value = "";
  step.value = "code";
  await nextTick();
  codeInput.value?.$el?.focus?.();
}

async function handleResend() {
  if (await sendCode(sentTo.value)) code.value = "";
}

async function handleVerifyCode() {
  loading.value = true;
  error.value = "";
  const result = await verifySignInCode(sentTo.value, code.value, { source });
  loading.value = false;
  if (result.success) {
    emit("signed-in");
  } else if (result.code && SERVICE_DOWN_CODES.has(result.code)) {
    emit("unavailable", sentTo.value);
  } else {
    error.value = result.error;
  }
}

function useDifferentEmail() {
  step.value = "email";
  code.value = "";
  error.value = "";
}
</script>
