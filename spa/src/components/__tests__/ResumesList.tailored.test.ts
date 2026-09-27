import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { computed, defineComponent, h, ref, type Ref } from "vue";

const resumes = ref<unknown[]>([]);
const tailored = ref<unknown[]>([]);
const tailoringFlag = ref(false);
const batchDelete = vi.fn();
const batchCommit = vi.fn();

let collectionCalls = 0;
vi.mock("vuefire", () => ({
  useCurrentUser: () => ref({ uid: "user-1" }),
  // First call: the resumes list; second: the tailored versions, empty while
  // the source is null (flag off), as vuefire does
  useCollection: (source: Ref<unknown>) =>
    collectionCalls++ % 2 === 0 ? Object.assign(resumes, { data: resumes }) : computed(() => (source.value ? tailored.value : [])),
  useFirebaseStorage: () => ({}),
  useStorageFileUrl: () => ({ url: ref(null) }),
}));
vi.mock("firebase/storage", () => ({ ref: () => ({}), deleteObject: vi.fn() }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  query: () => ({ query: true }),
  where: vi.fn(),
  orderBy: vi.fn(),
  getDocs: vi.fn(),
  doc: (_db: unknown, collectionName: string, id: string) => `${collectionName}/${id}`,
  writeBatch: () => ({ delete: batchDelete, commit: batchCommit, update: vi.fn() }),
}));
vi.mock("@/firebase/config.ts", () => ({ db: {} }));
vi.mock("@/firebase/config", () => ({ db: {}, functions: {} }));
vi.mock("@/composables/useJobApplicationsData", () => ({ useJobApplicationsData: () => ({ jobApplications: ref([]) }) }));
vi.mock("@/composables/useFeatureFlag", () => ({ useFeatureFlag: () => tailoringFlag }));
vi.mock("@/components/ai/TailoredResumeSheet.vue", () => ({
  default: defineComponent({
    props: ["open", "resume", "application"],
    setup: (props) => () => h("div", { "data-test": "tailored-sheet" }, `${props.application.companyName} ${props.resume.id} ${props.open}`),
  }),
}));

import ResumesList from "../ResumesList.vue";

enableAutoUnmount(afterEach);

const at = (day: number) => ({ toDate: () => new Date(2026, 8, day) });
const version = (id: string, resumeId: string, jobApplicationId: string, company: string, day: number) => ({
  id,
  resumeId,
  jobApplicationId,
  jobApplication: { id: jobApplicationId, companyName: company, position: "Engineer" },
  createdAt: at(day),
});

const mountList = async () => {
  const wrapper = mount(ResumesList, { attachTo: document.body, global: { stubs: { RouterLink: true, UploadResumeButton: true } } });
  await flushPromises();
  return wrapper;
};

describe("ResumesList: tailored versions", () => {
  beforeEach(() => {
    collectionCalls = 0;
    tailoringFlag.value = false;
    resumes.value = [
      { id: "resume-1", fileName: "sarah.pdf", status: "parsed", createdAt: at(1) },
      { id: "resume-2", fileName: "sarah-short.pdf", status: "parsed", createdAt: at(2) },
    ];
    // Newest first, as the query orders them
    tailored.value = [
      version("t3", "resume-1", "job-a", "Globex", 26),
      version("t2", "resume-2", "job-b", "Initech", 25),
      version("t1", "resume-1", "job-a", "Globex", 20),
    ];
    batchDelete.mockReset();
    batchCommit.mockReset().mockResolvedValue(undefined);
  });

  it("is hidden while the flag is off", async () => {
    const wrapper = await mountList();
    expect(wrapper.text()).not.toContain("Tailored versions");
  });

  it("lists the newest version per job under the right resume", async () => {
    tailoringFlag.value = true;
    const wrapper = await mountList();
    const [first, second] = wrapper.findAll("li").filter((item) => item.text().includes(".pdf"));
    expect(first!.text()).toContain("Globex · Engineer");
    expect(first!.text()).toContain("1 older");
    expect(first!.text()).not.toContain("Initech");
    expect(second!.text()).toContain("Initech · Engineer");
  });

  it("opens the tailored sheet for that resume and job", async () => {
    tailoringFlag.value = true;
    const wrapper = await mountList();
    await wrapper.findAll("button").find((button) => button.text() === "Globex · Engineer")!.trigger("click");
    expect(wrapper.find("[data-test=tailored-sheet]").text()).toBe("Globex resume-1 true");
  });

  it("deletes every version for that job after a confirm", async () => {
    tailoringFlag.value = true;
    const wrapper = await mountList();
    await wrapper.find('[aria-label="Delete the tailored versions for Globex · Engineer"]').trigger("click");
    expect(batchDelete).not.toHaveBeenCalled();
    await wrapper.findAll("button").find((button) => button.text() === "Delete for this job")!.trigger("click");
    await flushPromises();
    expect(batchDelete.mock.calls.map(([ref]) => ref)).toEqual(["tailoredResumes/t3", "tailoredResumes/t1"]);
    expect(batchCommit).toHaveBeenCalled();
  });
});
