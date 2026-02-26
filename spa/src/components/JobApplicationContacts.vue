<template>
  <Card>
    <CardHeader>
      <CardTitle>Contacts</CardTitle>
    </CardHeader>
    <CardContent>
      <template v-if="viewMode === 'contacts'">
        <div v-if="contacts.length" class="flex flex-col gap-6">
          <ul class="flex flex-col divide-y divide-border">
            <li
              v-for="contact in contacts"
              :key="contact.id"
              class="flex items-center gap-4 py-2"
            >
              <Avatar class="size-10">
                <AvatarImage
                  :src="`https://api.dicebear.com/9.x/lorelei-neutral/svg?seed=${contact.firstName}&size=40&backgroundColor=f9f7ff`"
                />
                <AvatarFallback>
                  {{ contact.firstName.charAt(0) }}
                  {{ contact.lastName.charAt(0) }}
                </AvatarFallback>
              </Avatar>
              <div class="flex flex-col grow">
                <p class="capitalize">
                  <a
                    v-if="contact.linkedInUrl"
                    :href="contact.linkedInUrl"
                    target="_blank"
                    class="text-primary hover:underline flex items-center gap-1"
                  >
                    {{ contact.firstName }} {{ contact.lastName }}
                    <PhArrowSquareOut />
                  </a>
                  <template v-else>
                    {{ contact.firstName }} {{ contact.lastName }}
                  </template>
                </p>
                <p class="text-gray-500 text-sm">{{ contact.position }}</p>
              </div>

              <div class="flex items-center">
                <Button
                  v-if="contact.email"
                  as="a"
                  variant="ghost"
                  size="sm"
                  :href="`mailto:${contact.email}`"
                  title="Send email"
                >
                  <PhPaperPlaneTilt class="text-primary" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  @click="
                    selectedContactId = contact.id;
                    viewMode = 'form';
                  "
                >
                  <PhPencil />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  @click="deleteContact(contact.id)"
                >
                  <PhTrash />
                </Button>
              </div>
            </li>
          </ul>
          <div class="flex justify-end">
            <Button size="sm" @click="viewMode = 'form'">
              <PhUserPlus />
              Add Contact</Button
            >
          </div>
        </div>
        <div
          v-else
          class="flex flex-col gap-2 items-center text-muted-foreground"
        >
          <PhUsers size="64" />
          <p class="mb-4 text-center">
            Keep track of important contacts for this job - you may need them
            later.
          </p>
          <Button size="sm" variant="outline" @click="viewMode = 'form'">
            <PhUserPlus />
            Add first contact
          </Button>
        </div>
      </template>

      <ContactForm
        v-if="viewMode === 'form'"
        :contact="
          selectedContact
            ? pick(selectedContact, [
                'firstName',
                'lastName',
                'linkedInUrl',
                'email',
                'position',
              ])
            : {
                firstName: '',
                lastName: '',
                linkedInUrl: '',
                email: '',
                position: '',
              }
        "
        @save="onContactFormSave"
        @cancel="
          viewMode = 'contacts';
          selectedContactId = '';
        "
      />
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useCollection, useCurrentUser } from "vuefire";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import pick from "lodash/pick";
import {
  PhArrowSquareOut,
  PhPaperPlaneTilt,
  PhPencil,
  PhTrash,
  PhUserPlus,
  PhUsers,
} from "@phosphor-icons/vue";
import { db } from "@/firebase/config.ts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Contact, ContactFormContact } from "@/types";
import ContactForm from "@/components/ContactForm.vue";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { trackEvent } from "@/analytics";

type JobApplicationContactsProps = {
  applicationId: string;
};

const { applicationId } = defineProps<JobApplicationContactsProps>();

const viewMode = ref<"contacts" | "form">("contacts");
const selectedContactId = ref("");
const selectedContact = computed(() =>
  contacts.value.find((contact) => contact.id === selectedContactId.value),
);

const user = useCurrentUser();
const q = computed(() =>
  user.value
    ? query(
        collection(db, "contacts"),
        where("userId", "==", user.value.uid),
        where("jobApplicationId", "==", applicationId),
        orderBy("createdAt", "asc"),
      )
    : null,
);
const { data: contacts } = useCollection<Contact>(q);

function updateContact(contact: ContactFormContact) {
  return updateDoc(doc(db, "contacts", selectedContactId.value), {
    ...contact,
    updatedAt: serverTimestamp(),
  });
}

async function addContact(contact: ContactFormContact, userId: string) {
  await addDoc(collection(db, "contacts"), {
    ...contact,
    createdAt: serverTimestamp(),
    userId,
    jobApplicationId: applicationId,
  });

  trackEvent("contact_created", { applicationId });
}

function deleteContact(contactId: string) {
  const ok = confirm("Are you sure you want to delete this contact?");
  if (ok) deleteDoc(doc(db, "contacts", contactId));
}

async function onContactFormSave(contact: ContactFormContact) {
  if (!user.value) return;

  if (selectedContactId.value) {
    await updateContact(contact);
  } else {
    await addContact(contact, user.value.uid);
  }

  selectedContactId.value = "";
  viewMode.value = "contacts";
}
</script>
