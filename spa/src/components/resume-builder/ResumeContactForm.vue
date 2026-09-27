<template>
  <section class="flex flex-col gap-3 rounded-card bg-card p-4 shadow-card dark:border dark:border-border" aria-labelledby="resume-contact-heading">
    <h2 id="resume-contact-heading" class="font-bold">You</h2>
    <div class="grid gap-3 sm:grid-cols-2">
      <div class="flex flex-col gap-1.5">
        <Label for="resume-name">Name</Label>
        <Input id="resume-name" v-model="contact.name" autocomplete="name" />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="resume-headline">Headline <span class="font-normal text-muted-foreground">(optional)</span></Label>
        <Input id="resume-headline" v-model="contact.headline" placeholder="Frontend Engineer" />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="resume-email">Email</Label>
        <Input id="resume-email" v-model="contact.email" type="email" autocomplete="email" />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="resume-phone">Phone <span class="font-normal text-muted-foreground">(optional)</span></Label>
        <Input id="resume-phone" v-model="contact.phone" type="tel" autocomplete="tel" />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="resume-location">Location <span class="font-normal text-muted-foreground">(optional)</span></Label>
        <Input id="resume-location" v-model="contact.location" placeholder="City, Country" />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="resume-links">Links <span class="font-normal text-muted-foreground">(LinkedIn, portfolio)</span></Label>
        <TagsInput id="resume-links" v-model="contact.links">
          <TagsInputItem v-for="(link, index) in contact.links" :key="`${link}-${index}`" :value="link">
            <TagsInputItemText class="px-2">{{ link }}</TagsInputItemText>
            <TagsInputItemDelete>
              <PhX :size="12" />
            </TagsInputItemDelete>
          </TagsInputItem>
          <TagsInputInput placeholder="linkedin.com/in/you, then Enter" class="flex-1" />
        </TagsInput>
      </div>
    </div>
    <ul v-if="hints.length" class="flex flex-col gap-1 text-sm text-muted-foreground">
      <li v-for="hint in hints" :key="hint" class="flex items-start gap-1.5"><PhInfo :size="16" class="mt-0.5 shrink-0" />{{ hint }}</li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { PhInfo, PhX } from "@phosphor-icons/vue";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TagsInput, TagsInputInput, TagsInputItem, TagsInputItemDelete, TagsInputItemText } from "@/components/ui/tags-input";
import { contactHints } from "@/lib/builtResumeEdit";
import type { ResumeContact } from "@/lib/builtResume";

const contact = defineModel<ResumeContact>({ required: true });

const hints = computed(() => contactHints(contact.value));
</script>
