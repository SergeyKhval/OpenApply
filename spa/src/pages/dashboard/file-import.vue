<template>
  <div class="h-full flex flex-col">
    <PageHeader>
      <div class="flex items-center w-full gap-6">
        <h2 class="text-2xl font-semibold whitespace-nowrap">Import jobs</h2>
      </div>
    </PageHeader>

    <div class="px-6 pb-6">
      <div v-if="data && data.length">
        <div class="sticky top-26">
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
              Upload new CSV
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
      <Card v-else>
        <CardHeader>
          <CardTitle>Import your job applications</CardTitle>
          <div class="py-3 sm:hidden">
            <Button @click="open" class="w-full">
              <PhFileCsv />
              Upload CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent class="mb-4">
          <div class="grid lg:grid-cols-2 gap-4">
            <div class="max-w-prose space-y-3">
              <p>
                Add your job applications in seconds by uploading a CSV file.
                You will be able to review before uploading, map columns, and
                choose which rows you want to import
              </p>
              <p class="text-sm leading-relaxed text-muted-foreground"></p>

              <h3 class="mt-6 text-sm font-medium text-foreground">
                Before you upload
              </h3>
              <ul
                class="mt-2 list-disc pl-5 space-y-1 text-sm leading-relaxed text-muted-foreground marker:text-muted-foreground/70"
              >
                <li>CSV with up to 100 rows.</li>
                <li>One row per job application.</li>
                <li>
                  Make sure you have at least these two columns:
                  <span class="font-medium text-foreground">Company name</span>
                  and <span class="font-medium text-foreground">Position</span>.
                </li>
                <li>
                  Rows without company name and position will be ignored during
                  import.
                </li>
                <li>Job description link column is optional.</li>
                <li>
                  Prefer no header row. If your file has a header, you can
                  delete that row after upload.
                </li>
                <li>
                  Extra columns are fine; only the mapped ones will be imported.
                </li>
              </ul>

              <h3 class="mt-6 text-sm font-medium text-foreground">
                How it works
              </h3>
              <ul
                class="mt-2 list-disc pl-5 space-y-1 text-sm leading-relaxed text-muted-foreground marker:text-muted-foreground/70"
              >
                <li>Click Upload CSV.</li>
                <li>
                  Map columns: choose which column is
                  <span class="font-medium text-foreground">Company name</span>
                  and which is
                  <span class="font-medium text-foreground">Position</span>.
                </li>
                <li>
                  Review & tidy: remove any rows you don’t want to import.
                </li>
                <li>Import: click Import to add your jobs.</li>
              </ul>
            </div>

            <div
              ref="drop-zone"
              class="hidden lg:flex w-full h-full border-border border border-dashed rounded-lg flex-col items-center justify-around"
              :class="isOverDropZone && 'border-solid border-primary'"
            >
              <div>
                <PhFileCsv class="text-muted-foreground" size="128" />
                <p class="text-muted-foreground">Drop CSV file here</p>
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter>
          <Button @click="open">
            <PhFileCsv />
            Upload CSV
          </Button>
        </CardFooter>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, useTemplateRef, watch } from "vue";
import { useRouter } from "vue-router";
import { useDropZone } from "@vueuse/core";
import fill from "lodash/fill";
import PapaParse from "papaparse";
import PageHeader from "@/components/PageHeader.vue";
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
  PhFileArrowUp,
  PhFileCsv,
  PhWarning,
  PhXCircle,
} from "@phosphor-icons/vue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config.ts";
import {
  Card,
  CardContent,
  CardFooter,
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

  await router.push("/dashboard/applications");
}
</script>

<route lang="yaml">
meta:
  requiresAuth: true
</route>
