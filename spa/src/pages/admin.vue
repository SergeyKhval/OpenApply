<template>
  <div class="p-6 grid grid-cols-8">
    <Card>
      <CardHeader>
        <CardTitle>Create billing profiles</CardTitle>
        <CardDescription>
          Create billing profiles and connect stripe account for users without
          them
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button @click="connectStripe">Connect stripe</Button>
      </CardFooter>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Migrate cover letters</CardTitle>
        <CardDescription>
          Nest job application data inside cover letters
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button @click="migrateCoverLetters">Migrate</Button>
      </CardFooter>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config.ts";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const connectStripe = httpsCallable(functions, "addProfilesToExistingUsers");
const migrateCoverLetters = httpsCallable(
  functions,
  "migrateCoverLettersToJobApplications",
);
</script>

<route lang="yaml">
meta:
  requiresAuth: true
  requiresAdmin: true
</route>
