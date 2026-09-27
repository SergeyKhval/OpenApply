<template>
  <SettingsShell>
    <!-- Canvas "Settings": one card, a row each for import and export. The card
         also takes a dropped CSV. -->
    <div ref="drop-zone" class="rounded-card transition-[box-shadow]" :class="isOverDropZone && 'ring-2 ring-ring'">
    <Card class="gap-0">
      <CardHeader><CardTitle class="text-lg">Import and export</CardTitle></CardHeader>
      <CardContent class="flex flex-col divide-y divide-border">
        <div class="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex flex-col gap-0.5">
            <p class="text-[15px] font-semibold">Import jobs from a spreadsheet</p>
            <p class="text-sm text-muted-foreground">CSV, up to 100 rows. We help you match the columns.</p>
          </div>
          <Button variant="outline" size="sm" class="self-start sm:self-auto" @click="open">
            <PhUploadSimple />
            Choose file
          </Button>
        </div>
        <div class="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex flex-col gap-0.5">
            <p class="text-[15px] font-semibold">Export all jobs</p>
            <p class="text-sm text-muted-foreground">CSV with stages, dates, notes and links.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            class="self-start sm:self-auto"
            :disabled="exporting || !jobApplications.length"
            @click="exportJobs"
          >
            <Spinner v-if="exporting" />
            <PhDownloadSimple v-else />
            Export CSV
          </Button>
        </div>
      </CardContent>
    </Card>
    </div>

    <!-- After a file is chosen: match the columns, drop rows, import -->
    <section v-if="data && data.length" aria-labelledby="csv-columns-heading" class="flex flex-col gap-2">
      <h2 id="csv-columns-heading" class="mt-2 text-lg font-bold">Match the columns</h2>
      <p class="text-sm text-muted-foreground">
        Pick which column is the company name and which is the position; a job link is optional. Rows without a company
        and a position are skipped, and a header row can be removed below.
      </p>
      <div>
        <div class="sticky top-22 z-10 bg-background py-2">
          <div
            class="flex flex-col sm:flex-row items-start sm:items-center gap-2"
          >
            <Button
              size="sm"
              :disabled="importingJobs"
              @click="importJobApplications"
            >
              <Spinner v-if="importingJobs" />
              <PhFileArrowUp v-else />
              Import job applications
            </Button>
            <Button size="sm" variant="secondary" @click="open">
              <PhFileCsv />
              Choose another file
            </Button>
          </div>

          <Alert v-if="data.length >= 100" variant="destructive" class="mt-2">
            <PhWarning class="text-destructive" />
            <AlertDescription
              >Your CSV file contains more then 100 rows. Please remove extra
              rows or upload a new CSV file</AlertDescription
            >
          </Alert>
        </div>
        <div class="max-w-full overflow-x-auto mt-4">
          <table class="w-full">
            <thead>
              <tr>
                <th />
                <th
                  v-for="n in data[0].length"
                  :key="n"
                  class="pb-2 pr-2 text-left"
                >
                  <div class="flex items-center gap-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger as-child>
                        <Button size="sm" variant="outline">
                          {{
                            possibleHeaders.get(headers[n - 1])?.column ||
                            "Select"
                          }}
                          <PhCaretUpDown />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuLabel
                          >Select column name</DropdownMenuLabel
                        >
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          class="text-muted-foreground"
                          @click="setHeader('', n - 1)"
                          >None</DropdownMenuItem
                        >
                        <DropdownMenuItem
                          v-for="[key, options] in possibleHeaders.entries()"
                          :key="key"
                          @click="setHeader(key, n - 1)"
                        >
                          {{ options.column }}
                          {{ options.isOptional ? "(optional)" : "" }}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              <tr v-for="(row, rowIndex) in data" :key="rowIndex">
                <td class="py-1">
                  <Button
                    variant="outline"
                    size="sm"
                    title="Remove row"
                    @click="data.splice(rowIndex, 1)"
                    ><PhXCircle class="text-destructive"
                  /></Button>
                </td>
                <td
                  v-for="(cell, cellIndex) in row"
                  :key="cellIndex"
                  class="max-w-40 truncate px-2 py-1 text-xs"
                  :title="cell"
                >
                  {{ cell }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </SettingsShell>
</template>

<script setup lang="ts">
import { ref, useTemplateRef, watch } from "vue";
import { useRouter } from "vue-router";
import { useDropZone } from "@vueuse/core";
import fill from "lodash/fill";
import PapaParse from "papaparse";
import SettingsShell from "@/components/settings/SettingsShell.vue";
import { useCurrentUser } from "vuefire";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/firebase/config.ts";
import { useJobApplicationsData } from "@/composables/useJobApplicationsData";
import { downloadCsv, jobsToCsv } from "@/lib/exportJobsCsv";
import { useFileDialog } from "@vueuse/core";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PhCaretUpDown,
  PhDownloadSimple,
  PhFileArrowUp,
  PhFileCsv,
  PhUploadSimple,
  PhWarning,
  PhXCircle,
} from "@phosphor-icons/vue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config.ts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { trackEvent } from "@/analytics";

type ColumnHeader = "companyName" | "position" | "jobDescriptionLink" | "";

const possibleHeaders = new Map<
  ColumnHeader,
  { column: string; isOptional?: boolean }
>([
  ["companyName", { column: "Company name", isOptional: false }],
  ["position", { column: "Position", isOptional: false }],
  ["jobDescriptionLink", { column: "Job link", isOptional: true }],
]);

const router = useRouter();
const dropZoneRef = useTemplateRef("drop-zone");

const data = ref<Array<Array<string>>>([]);
const headers = ref<ColumnHeader[]>([]);
watch(data, (newData) => {
  if (newData && newData.length > 0) {
    headers.value = fill(new Array(newData[0].length), "");
  } else {
    headers.value = [];
  }
});
const importingJobs = ref(false);

function parseFiles(files: FileList | File[] | null) {
  const file = files?.[0];

  if (file) {
    PapaParse.parse<string[]>(file, {
      complete(results) {
        reset();
        data.value = results.data;
      },
    });
  }
}

const { open, reset, onChange } = useFileDialog({
  accept: "text/csv",
  multiple: false,
});
const { isOverDropZone } = useDropZone(dropZoneRef, {
  onDrop: parseFiles,
  dataTypes: ["text/csv"],
  multiple: false,
  preventDefaultForUnhandled: true,
});

onChange(parseFiles);

function prepareFirebaseData() {
  if (
    !headers.value.includes("companyName") ||
    !headers.value.includes("position")
  ) {
    alert("Please specify both Company name and Position columns.");
    return [];
  }
  if (!data.value) return [];

  return data.value.map((row: string[]) => {
    const rowObject: Record<string, string> = {};

    headers.value.forEach((header, index) => {
      if (header) {
        rowObject[header] = row[index];
      }
    });

    return rowObject;
  });
}

function setHeader(header: ColumnHeader, index: number) {
  headers.value.forEach((h, i) => {
    if (h === header) {
      headers.value[i] = "";
    }
    if (i === index) {
      headers.value[i] = header;
    }
  });
}

async function importJobApplications() {
  importingJobs.value = true;
  const preparedData = prepareFirebaseData();
  if (!preparedData.length) {
    importingJobs.value = false;
    return;
  }
  const importJobApplications = httpsCallable(
    functions,
    "importJobApplications",
  );

  try {
    await importJobApplications({ applications: preparedData });
    trackEvent("csv_import_completed", { rowCount: preparedData.length });
  } catch (_e) {
    alert(
      "There was an error importing your job applications. Please try again.",
    );
  } finally {
    importingJobs.value = false;
  }

  await router.push("/jobs");
}

// Export: every job plus its notes, as one CSV
const user = useCurrentUser();
const { jobApplications } = useJobApplicationsData();
const exporting = ref(false);

async function exportJobs() {
  if (!user.value) return;
  exporting.value = true;
  try {
    const notes = await getDocs(
      query(collection(db, "jobApplicationNotes"), where("userId", "==", user.value.uid)),
    );
    const notesByJob = new Map<string, string[]>();
    for (const note of notes.docs) {
      const { jobApplicationId, text } = note.data() as { jobApplicationId: string; text: string };
      notesByJob.set(jobApplicationId, [...(notesByJob.get(jobApplicationId) ?? []), text]);
    }
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`openapply-jobs-${stamp}.csv`, jobsToCsv(jobApplications.value ?? [], notesByJob));
    trackEvent("jobs_exported", { rowCount: jobApplications.value?.length ?? 0 });
  } finally {
    exporting.value = false;
  }
}
</script>

<route lang="yaml">
meta:
  requiresAuth: true
</route>
