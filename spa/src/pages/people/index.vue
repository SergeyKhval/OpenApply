<template>
  <div>
    <PageHeader>
      <h1 class="text-2xl font-extrabold whitespace-nowrap lg:text-3xl">People</h1>
    </PageHeader>

    <div class="px-6">
      <PeopleList />
    </div>
  </div>
</template>

<script setup lang="ts">
import PageHeader from "@/components/PageHeader.vue";
import PeopleList from "@/components/PeopleList.vue";
</script>

<route lang="yaml">
meta:
  requiresAuth: true
</route>
