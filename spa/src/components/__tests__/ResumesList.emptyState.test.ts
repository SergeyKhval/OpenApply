import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RouterLinkStub, enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { computed, defineComponent, h, ref } from "vue";

const resumes = ref<unknown[]>([]);

let collectionCalls = 0;
vi.mock("vuefire", () => ({
  useCurrentUser: () => ref({ uid: "user-1" }),
  // First call: the resumes list; second: the tailored versions, empty here
  useCollection: () => (collectionCalls++ % 2 === 0 ? Object.assign(resumes, { data: resumes }) : computed(() => [])),
  useFirebaseStorage: () => ({}),
  useStorageFileUrl: () => ({ url: ref(null) }),
}));
const deleteObject = vi.fn();
const batchDelete = vi.fn();
vi.mock("firebase/storage", () => ({ ref: () => ({}), deleteObject: (...args: unknown[]) => deleteObject(...args) }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  query: () => ({ query: true }),
  where: vi.fn(),
  orderBy: vi.fn(),
  getDocs: async () => ({ size: 0, forEach: () => {} }),
  doc: vi.fn(),
  writeBatch: () => ({ delete: batchDelete, commit: vi.fn(), update: vi.fn() }),
}));
vi.mock("@/firebase/config.ts", () => ({ db: {} }));
vi.mock("@/firebase/config", () => ({ db: {}, functions: {} }));
vi.mock("vue-router", async (importOriginal) => ({ ...(await importOriginal<object>()), useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/composables/useResumeImport", () => ({ importResume: vi.fn() }));
vi.mock("@/composables/useJobApplicationsData", () => ({ useJobApplicationsData: () => ({ jobApplications: ref([]) }) }));
vi.mock("@/components/ai/TailoredResumeSheet.vue", () => ({
  default: defineComponent({
    props: ["open", "resume", "application"],
    setup: () => () => h("div", { "data-test": "tailored-sheet" }),
  }),
}));

import ResumesList from "../ResumesList.vue";

enableAutoUnmount(afterEach);

const at = (day: number) => ({ toDate: () => new Date(2026, 8, day) });

const mountList = async () => {
  const wrapper = mount(ResumesList, { attachTo: document.body, global: { stubs: { RouterLink: RouterLinkStub, UploadResumeButton: true, NewResumeButton: true } } });
  await flushPromises();
  return wrapper;
};

describe("ResumesList: empty state", () => {
  beforeEach(() => {
    collectionCalls = 0;
  });

  it("does not show the empty state when resumes are present", async () => {
    resumes.value = [{ id: "resume-1", fileName: "sarah.pdf", status: "parsed", createdAt: at(1) }];
    const wrapper = await mountList();
    expect(wrapper.text()).not.toContain("No resumes yet");
  });

  it("shows the empty state when there are no resumes", async () => {
    resumes.value = [];
    const wrapper = await mountList();
    expect(wrapper.text()).toContain("No resumes yet");
  });
});

describe("ResumesList: a resume built in the app", () => {
  const built = {
    id: "resume-2",
    kind: "built",
    title: "Product roles",
    status: "parsed",
    createdAt: at(2),
    structured: { version: 1, contact: {}, sections: [] },
  };

  beforeEach(() => {
    collectionCalls = 0;
    deleteObject.mockClear();
    batchDelete.mockClear();
    resumes.value = [built];
  });

  it("shows its title, with no file size or read status", async () => {
    const wrapper = await mountList();
    expect(wrapper.text()).toContain("Product roles");
    expect(wrapper.text()).toContain("Made here");
    expect(wrapper.text()).not.toContain("Read OK");
    expect(wrapper.text()).not.toContain("Uploaded");
  });

  it("deletes the doc without touching Storage", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const wrapper = await mountList();
    await wrapper.get('[aria-label="Options for Product roles"]').trigger("keydown", { key: "Enter" });
    await flushPromises();
    const items = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    expect(items.map((item) => item.textContent?.trim())).toEqual(["Delete"]);
    items[0].click();
    await flushPromises();
    expect(batchDelete).toHaveBeenCalledTimes(1);
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it("says which PDF it was made from", async () => {
    resumes.value = [
      { ...built, importedFrom: { source: "resume", resumeId: "resume-1", flaggedFields: [] } },
      { id: "resume-1", fileName: "sarah.pdf", status: "parsed", createdAt: at(1) },
    ];
    const wrapper = await mountList();
    expect(wrapper.text()).toContain("Made from sarah.pdf");
  });
});

describe("ResumesList: resume builder entry points", () => {
  beforeEach(() => {
    collectionCalls = 0;
  });

  it("offers building one next to the upload when there are none", async () => {
    resumes.value = [];
    const wrapper = await mountList();
    expect(wrapper.findComponent({ name: "NewResumeButton" }).props("surface")).toBe("resumes_empty");
  });

  it("offers editing an uploaded PDF as a new resume from its menu", async () => {
    resumes.value = [{ id: "resume-1", fileName: "sarah.pdf", status: "parsed", createdAt: at(1) }];
    const wrapper = await mountList();
    await wrapper.get('[aria-label="Options for sarah.pdf"]').trigger("keydown", { key: "Enter" });
    await flushPromises();
    const items = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')].map((item) => item.textContent?.trim());
    expect(items).toEqual(["Edit as a new resume", "Delete"]);
  });
});
