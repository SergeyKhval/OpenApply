import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";

const openDialog = vi.fn();
let onFileChosen: (files: File[]) => void = () => {};
vi.mock("@vueuse/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vueuse/core")>()),
  useFileDialog: () => ({
    open: openDialog,
    reset: vi.fn(),
    onChange: (callback: (files: File[]) => void) => (onFileChosen = callback),
  }),
}));
// Parse synchronously: two rows, three columns
vi.mock("papaparse", () => ({
  default: {
    parse: (_file: File, options: { complete: (results: { data: string[][] }) => void }) =>
      options.complete({ data: [["Acme", "Engineer", "https://acme.example/jobs/1"], ["Globex", "Designer", ""]] }),
  },
}));
vi.mock("vuefire", () => ({ useCurrentUser: () => ref({ uid: "u1" }) }));
vi.mock("@/firebase/config.ts", () => ({ db: {}, functions: {} }));
vi.mock("@/composables/useJobApplicationsData", () => ({
  useJobApplicationsData: () => ({ jobApplications: ref([{ id: "j1" }]) }),
}));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/analytics", () => ({ trackEvent: vi.fn() }));

import ImportExportPage from "../import-export.vue";

const mountPage = () =>
  mount(ImportExportPage, { global: { stubs: { SettingsShell: { template: "<div><slot /></div>" } } } });

describe("Settings > Import and export", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is one card with a row for import and a row for export, as on the canvas", () => {
    const wrapper = mountPage();
    expect(wrapper.text()).toContain("Import and export");
    expect(wrapper.text()).toContain("Import jobs from a spreadsheet");
    expect(wrapper.text()).toContain("CSV, up to 100 rows. We help you match the columns.");
    expect(wrapper.text()).toContain("Export all jobs");
    expect(wrapper.text()).not.toContain("Before you upload");
    expect(wrapper.text()).not.toContain("Match the columns");
  });

  it("Choose file opens the file picker", async () => {
    const wrapper = mountPage();
    await wrapper.findAll("button").find((button) => button.text() === "Choose file")!.trigger("click");
    expect(openDialog).toHaveBeenCalled();
  });

  it("after a file is chosen, shows the rows to match and import", async () => {
    const wrapper = mountPage();
    onFileChosen([new File(["x"], "jobs.csv", { type: "text/csv" })]);
    await flushPromises();
    expect(wrapper.text()).toContain("Match the columns");
    expect(wrapper.findAll("tbody tr")).toHaveLength(2);
    expect(wrapper.text()).toContain("Import job applications");
  });
});
