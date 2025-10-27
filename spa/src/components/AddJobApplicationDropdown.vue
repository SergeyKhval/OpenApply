<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button>
        Add <span class="hidden sm:inline">job application</span>
        <PhCaretDown />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem
        @click="
          $router.replace({
            query: { ...$route.query, 'dialog-name': 'add-job-application' },
          })
        "
      >
        <PhBriefcase />
        Via link or manually
      </DropdownMenuItem>
      <DropdownMenuItem>
        <RouterLink to="/dashboard/file-import" class="flex items-center gap-2">
          <PhFileCsv />
          Import from CSV
        </RouterLink></DropdownMenuItem
      >
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { PhBriefcase, PhCaretDown, PhFileCsv } from "@phosphor-icons/vue";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
</script>
