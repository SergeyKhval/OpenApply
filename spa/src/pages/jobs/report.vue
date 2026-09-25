<!-- From the extension's "Report this posting": opens the saved job with the report dialog, or asks to save it first -->
<template>
  <div>
    <PageHeader>
      <nav aria-label="Breadcrumb" class="flex min-w-0 grow items-center gap-1.5 text-[15px]">
        <RouterLink to="/jobs" class="inline-flex items-center gap-1 font-semibold hover:underline">
          <PhCaretLeft :size="16" />
          Jobs
        </RouterLink>
      </nav>
    </PageHeader>
    <div class="flex max-w-xl flex-col gap-4 px-4 pb-12 lg:px-6">
      <p v-if="state === 'looking'" class="text-muted-foreground">Finding this job in your tracker…</p>
      <template v-else-if="state === 'not-saved'">
        <h1 class="text-2xl font-extrabold">Save the job first</h1>
        <p class="text-soft-foreground">
          Reports come from people who saved the job, so they can say what happened with their application. Save it to
          your tracker, then report it from the job's page.
        </p>
        <Button v-if="saveHref" as-child class="self-start">
          <a :href="saveHref">Save this job</a>
        </Button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useCurrentUser } from "vuefire";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { PhCaretLeft } from "@phosphor-icons/vue";
import { db } from "@/firebase/config";
import PageHeader from "@/components/PageHeader.vue";
import { Button } from "@/components/ui/button";

const route = useRoute();
const router = useRouter();
const user = useCurrentUser();
const state = ref<"looking" | "not-saved">("looking");

const hash = typeof route.query.job === "string" && /^[0-9a-f]{64}$/.test(route.query.job) ? route.query.job : "";
const jobUrl = typeof route.query.url === "string" && /^https?:\/\//.test(route.query.url) ? route.query.url : "";
const saveHref = computed(() => (jobUrl ? `${window.location.origin}/save?${new URLSearchParams({ url: jobUrl })}` : ""));

onMounted(async () => {
  if (!hash || !user.value) {
    state.value = "not-saved";
    return;
  }
  const { docs } = await getDocs(
    query(collection(db, "jobApplications"), where("userId", "==", user.value.uid), where("jobKeyHash", "==", hash), limit(1)),
  );
  if (docs[0]) await router.replace({ path: `/jobs/${docs[0].id}`, query: { report: "1" } });
  else state.value = "not-saved";
});
</script>

<route lang="yaml">
meta:
  requiresAuth: true
</route>
