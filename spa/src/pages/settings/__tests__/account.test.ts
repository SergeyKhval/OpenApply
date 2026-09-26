import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { enableAutoUnmount, flushPromises, mount, DOMWrapper } from "@vue/test-utils";
import { ref } from "vue";

enableAutoUnmount(afterEach);

const mockHttpsCallable = vi.fn();
vi.mock("firebase/functions", () => ({
  httpsCallable: () => mockHttpsCallable,
}));
vi.mock("@/firebase/config", () => ({ functions: "mock-functions" }));

const mockUser = ref<{ email: string; providerData: { providerId: string }[] } | null>({
  email: "maya.chen@example.com",
  providerData: [{ providerId: "password" }],
});
vi.mock("vuefire", () => ({ useCurrentUser: () => mockUser }));

const mockLogout = vi.fn();
vi.mock("@/composables/useAuth", () => ({
  useAuth: () => ({ logout: mockLogout }),
}));

const mockPush = vi.fn();
vi.mock("vue-router", () => ({ useRouter: () => ({ push: mockPush }) }));

const mockTrackEvent = vi.fn();
vi.mock("@/analytics", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

import AccountPage from "../account.vue";

const mountPage = () =>
  mount(AccountPage, {
    attachTo: document.body,
    global: {
      stubs: { SettingsShell: { template: "<div><slot /></div>" }, RouterLink: { template: "<a><slot /></a>" } },
    },
  });

// DialogContent teleports the delete-confirmation form to document.body via
// reka-ui's DialogPortal, so it lands outside the mounted wrapper's own
// element tree; query the document directly instead of `wrapper.find`.
const confirmInput = () => new DOMWrapper(document.querySelector("#delete-confirm") as Element);
const confirmForm = () => new DOMWrapper(document.querySelector("#delete-confirm")!.closest("form") as Element);

describe("Settings > Account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogout.mockResolvedValue({ success: true });
  });

  it("tracks account_deleted and signs the user out after a successful delete", async () => {
    mockHttpsCallable.mockResolvedValueOnce({ data: { success: true } });
    const wrapper = mountPage();

    await wrapper.findAll("button").find((b) => b.text().includes("Delete…"))?.trigger("click");
    await confirmInput().setValue("DELETE");
    await confirmForm().trigger("submit");
    await flushPromises();

    expect(mockHttpsCallable).toHaveBeenCalledWith({ confirm: "DELETE" });
    expect(mockTrackEvent).toHaveBeenCalledWith("account_deleted");
    expect(mockLogout).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("does not track account_deleted when the callable fails", async () => {
    mockHttpsCallable.mockRejectedValueOnce({ code: "functions/internal", message: "boom" });
    const wrapper = mountPage();

    await wrapper.findAll("button").find((b) => b.text().includes("Delete…"))?.trigger("click");
    await confirmInput().setValue("DELETE");
    await confirmForm().trigger("submit");
    await flushPromises();

    expect(mockTrackEvent).not.toHaveBeenCalledWith("account_deleted");
    expect(mockLogout).not.toHaveBeenCalled();
  });
});
