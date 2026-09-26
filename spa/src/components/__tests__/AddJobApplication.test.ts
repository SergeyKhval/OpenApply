import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { enableAutoUnmount, mount, flushPromises } from "@vue/test-utils";
import { ref } from "vue";

enableAutoUnmount(afterEach);

// useJobIngestion.ts imports `db`/`functions` from here at module load time;
// vi.importActual below still runs that top-level import, so without this
// mock it initializes real Firebase and throws auth/invalid-api-key in CI
// (no spa/.env there).
vi.mock("@/firebase/config", () => ({ db: "mock-db", functions: "mock-functions" }));

const mockStart = vi.fn();
const mockReset = vi.fn();
const mockStatus = ref("idle");
const mockLatestSnapshot = ref<unknown>(null);

vi.mock("@/composables/useJobIngestion.ts", async () => {
  const actual = await vi.importActual<typeof import("@/composables/useJobIngestion.ts")>(
    "@/composables/useJobIngestion.ts",
  );
  return {
    ...actual,
    useJobIngestion: () => ({
      start: mockStart,
      reset: mockReset,
      status: mockStatus,
      errorMessage: ref(null),
      latestSnapshot: mockLatestSnapshot,
    }),
  };
});

const mockRoute = { query: {} as Record<string, string> };
const mockRouter = { push: vi.fn(), replace: vi.fn() };
vi.mock("vue-router", () => ({
  useRoute: () => mockRoute,
  useRouter: () => mockRouter,
}));

const mockTrackEvent = vi.fn();
vi.mock("@/analytics", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

import AddJobApplication from "../AddJobApplication.vue";

const mountDialog = () =>
  mount(AddJobApplication, {
    props: { isOpen: true },
    global: {
      stubs: {
        // The real DialogScrollContent teleports via reka-ui's DialogPortal,
        // which the JobReportSection test also avoids; render its slot in
        // place instead. Keep the outer Dialog real: DialogTitle/Description
        // (still real, nested inside) need its injected DialogRootContext.
        DialogScrollContent: { template: "<div><slot /></div>" },
        JobApplicationForm: { template: "<div />" },
        MessageRotator: { template: "<div />" },
      },
    },
  });

describe("AddJobApplication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoute.query = {};
    mockStatus.value = "idle";
    mockStart.mockResolvedValue(undefined);
  });

  it("tracks job_input_submitted for a plain link on the add-dialog surface", async () => {
    const wrapper = mountDialog();

    await wrapper.find("#jobLink").setValue("https://example.com/careers/123");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(mockTrackEvent).toHaveBeenCalledWith("job_input_submitted", {
      input: "link",
      surface: "add_dialog",
    });
    expect(mockStart).toHaveBeenCalledWith("https://example.com/careers/123");
  });

  it("tracks job_board_shortcut_shown instead of submitting for a LinkedIn job link", async () => {
    const wrapper = mountDialog();

    await wrapper.find("#jobLink").setValue("https://www.linkedin.com/jobs/view/12345");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(mockTrackEvent).toHaveBeenCalledWith("job_board_shortcut_shown", {
      board: "linkedin",
      surface: "add_dialog",
    });
    expect(mockTrackEvent).not.toHaveBeenCalledWith("job_input_submitted", expect.anything());
    expect(mockStart).not.toHaveBeenCalled();
  });

  it("tracks job_input_submitted for a pasted description", async () => {
    const wrapper = mountDialog();
    const description = "We are hiring a senior engineer. ".repeat(10);

    await wrapper.find("#jobLink").setValue(description);
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(mockTrackEvent).toHaveBeenCalledWith("job_input_submitted", {
      input: "text",
      surface: "add_dialog",
    });
  });

  it("uses the first_run surface when opened with a prefilled job-link query param", async () => {
    mockRoute.query = { "job-link": "https://example.com/careers/456" };
    mountDialog();
    await flushPromises();

    expect(mockTrackEvent).toHaveBeenCalledWith("job_input_submitted", {
      input: "link",
      surface: "first_run",
    });
    expect(mockStart).toHaveBeenCalledWith("https://example.com/careers/456");
  });
});
