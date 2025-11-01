<template>
  <div class="p-6 grid grid-cols-8 gap-4">
    <div>
      <Button @click="migrateJobDescriptions()">
        Migrate job descriptions
      </Button>
    </div>
    <div class="col-span-8 grid-cols-subgrid grid">
      <Card v-if="jobParserTemplate" class="col-span-3">
        <CardContent>
          <div class="flex flex-col gap-2">
            <Label>Parser prompt</Label>
            <Textarea v-model="parserTemplate" />
          </div>
        </CardContent>
        <CardFooter>
          <Button
            @click="updateDoc(jobParserDocRef, { template: parserTemplate })"
          >
            Save
          </Button>
        </CardFooter>
      </Card>

      <Card v-if="coverLetterTemplateDoc" class="col-span-3">
        <CardContent>
          <div class="flex flex-col gap-2">
            <Label>Cover letter prompt</Label>
            <Textarea v-model="coverLetterTemplate" />
          </div>
        </CardContent>
        <CardFooter>
          <Button
            @click="
              updateDoc(coverLetterDocRef, { template: coverLetterTemplate })
            "
          >
            Save
          </Button>
        </CardFooter>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { Button } from "@/components/ui/button";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/firebase/config.ts";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useDocument } from "vuefire";
import { collection, doc, updateDoc } from "firebase/firestore";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const parserTemplate = ref("");
const jobParserDocRef = doc(collection(db, "promptTemplates"), "jobParser");
const jobParserTemplate = useDocument(jobParserDocRef);
watch(jobParserTemplate, (newDoc) => {
  if (newDoc && newDoc.template) {
    parserTemplate.value = newDoc.template;
  }
});

const coverLetterTemplate = ref("");
const coverLetterDocRef = doc(collection(db, "promptTemplates"), "coverLetter");
const coverLetterTemplateDoc = useDocument(coverLetterDocRef);
watch(coverLetterTemplateDoc, (newDoc) => {
  if (newDoc && newDoc.template) {
    coverLetterTemplate.value = newDoc.template;
  }
});

const migrateJobDescriptions = httpsCallable(
  functions,
  "migrateJobDescriptions",
);
</script>

<route lang="yaml">
meta:
  requiresAuth: true
  requiresAdmin: true
</route>
