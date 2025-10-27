<template>
  <form @submit.prevent="onSubmit" class="flex flex-col gap-4">
    <div class="grid grid-cols-2 gap-6">
      <div class="flex flex-col gap-2">
        <Label for="first-name">First name</Label>
        <div>
          <Input
            id="first-name"
            v-model="contactForm.firstName"
            :class="
              v$.firstName.$dirty &&
              v$.firstName.$invalid &&
              'border-destructive'
            "
            placeholder="Karen"
          />
          <p
            v-if="v$.firstName.$dirty && v$.firstName.$invalid"
            class="text-destructive text-xs mt-1"
          >
            First name is required
          </p>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <Label for="last-name">Last name</Label>
        <Input
          id="last-name"
          v-model="contactForm.lastName"
          placeholder="Doe"
        />
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <Label for="position">Position</Label>
      <Input
        id="position"
        v-model="contactForm.position"
        placeholder="Hiring manager"
      />
    </div>

    <div class="flex flex-col gap-2">
      <Label for="email">Email</Label>
      <div>
        <Input
          id="email"
          v-model="contactForm.email"
          placeholder="karen@office.com"
          :class="v$.email.$dirty && v$.email.$invalid && 'border-destructive'"
        />
        <p
          v-if="v$.email.$dirty && v$.email.$invalid"
          class="text-xs text-destructive mt-1"
        >
          Email should be valid
        </p>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <Label for="linkedin-url">LinkedIn</Label>
      <div>
        <Input
          id="linkedin-url"
          v-model="contactForm.linkedInUrl"
          placeholder="https://linkedin.com/in..."
          :class="
            v$.linkedInUrl.$dirty &&
            v$.linkedInUrl.$invalid &&
            'border-destructive'
          "
        />
        <p
          v-if="v$.linkedInUrl.$dirty && v$.linkedInUrl.$invalid"
          class="text-xs text-destructive mt-1"
        >
          LinkedIn link should be a correct URL
        </p>
      </div>
    </div>

    <div class="flex items-center gap-2 justify-end">
      <Button size="sm">
        <PhCheckFat />
        Save</Button
      >
      <Button size="sm" variant="secondary" @click="emit('cancel')">
        <PhRewind />
        Cancel</Button
      >
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import { onKeyStroke } from "@vueuse/core";
import { PhCheckFat, PhRewind } from "@phosphor-icons/vue";
import { useVuelidate } from "@vuelidate/core";
import { required, email, url } from "@vuelidate/validators";
import { type ContactFormContact } from "@/types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type ContactFormProps = {
  contact: ContactFormContact;
};
type ContactFormEmits = {
  (event: "save", payload: ContactFormContact): void;
  (event: "cancel"): void;
};

const { contact } = defineProps<ContactFormProps>();
const emit = defineEmits<ContactFormEmits>();

const contactForm = reactive<ContactFormContact>({ ...contact });

const rules = computed(() => ({
  firstName: { required },
  email: { email },
  linkedInUrl: { url },
}));
const v$ = useVuelidate(rules, contactForm);

watch(
  () => contact,
  (newContact) => {
    Object.assign(contactForm, newContact);
    v$.value.$reset();
  },
  { deep: true },
);

function onSubmit() {
  v$.value.$touch();

  if (v$.value.$invalid) return;

  emit("save", contactForm);
}

onKeyStroke("Escape", () => emit("cancel"));
</script>
