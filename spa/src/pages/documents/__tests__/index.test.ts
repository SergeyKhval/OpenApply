import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";

const query = ref<Record<string, string>>({});
vi.mock("vue-router", () => ({
  useRoute: () => ({ query: query.value }),
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock("@/composables/useResumes", () => ({ useResumes: () => ({ data: ref([{ id: "a" }, { id: "b" }]) }) }));
vi.mock("@/composables/useCoverLetters", () => ({ useCoverLetters: () => ({ coverLetters: ref([{}, {}, {}]) }) }));
vi.mock("@/composables/useResumeUpload", () => ({ useResumeUpload: () => ({ isUploading: ref(false), openFileDialog: vi.fn() }) }));

vi.mock("@/firebase/config", () => ({ db: {}, auth: {}, storage: {}, functions: {} }));
vi.mock("@/components/ResumesList.vue", () => ({ default: { template: "<div />" } }));
vi.mock("@/components/CoverLettersList.vue", () => ({ default: { template: "<div />" } }));

import DocumentsPage from "../index.vue";

const mountPage = () =>
  mount(DocumentsPage, {
    global: { stubs: { ResumesList: true, CoverLettersList: true, AppSearch: true, NewResumeButton: true }, mocks: { $router: { replace: vi.fn() }, $route: { query: {} } } },
  });

describe("Documents page", () => {
  it("puts the tabs, with counts, next to the title", () => {
    const wrapper = mountPage();
    expect(wrapper.get("h1").text()).toBe("Documents");
    expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toEqual(["Resumes · 2", "Cover letters · 3"]);
  });

  it("has no header bar", () => {
    expect(mountPage().find(".border-b").exists()).toBe(false);
  });

  it("the upload button keeps its name when it's only an icon on phones", () => {
    expect(mountPage().find('button[aria-label="Upload resume"]').exists()).toBe(true);
  });

  it("has the resume builder's New resume next to Upload (the button hides itself while the flag is off)", () => {
    expect(mountPage().findComponent({ name: "NewResumeButton" }).attributes("surface")).toBe("documents_header");
  });
});
