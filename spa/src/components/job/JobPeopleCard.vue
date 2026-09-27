<!-- Job page: the people you talked to about this job (canvas "People").
     Adding and editing stays in the timeline. -->
<template>
  <Card class="gap-3">
    <CardHeader>
      <CardTitle class="text-base">People</CardTitle>
    </CardHeader>
    <CardContent>
      <ul class="flex flex-col gap-3">
        <li v-for="contact in contacts" :key="contact.id" class="flex items-center gap-3">
          <span class="grid size-10 shrink-0 place-items-center rounded-full bg-success-soft text-sm font-bold text-success">
            {{ initials(contact) }}
          </span>
          <div class="flex min-w-0 flex-col">
            <span class="text-[15px] font-semibold">{{ `${contact.firstName} ${contact.lastName}`.trim() }}</span>
            <span class="truncate text-[13px] text-muted-foreground">
              {{ contact.position }}<template v-if="contact.position && contact.email"> · </template>
              <a v-if="contact.email" :href="`mailto:${contact.email}`" class="hover:underline">{{ contact.email }}</a>
            </span>
          </div>
        </li>
      </ul>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Contact } from "@/types";

const { contacts } = defineProps<{ contacts: Contact[] }>();

const initials = (contact: Contact) =>
  `${contact.firstName.trim()[0] ?? ""}${contact.lastName.trim()[0] ?? ""}`.toUpperCase() || "?";
</script>
