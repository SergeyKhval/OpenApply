import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { computed, defineComponent, ref } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { getAllowanceState } from "@/lib/aiAllowance";
import { isNavActive } from "../mainNav";

const logout = vi.fn(async () => ({ success: true }));
const billing = ref<Record<string, unknown> | null>({ aiUsage: { period: "2026-09", count: 3 } });

vi.mock("@/composables/useAuth", () => ({
  useAuth: () => ({
    user: ref({ displayName: "Maya Chen", email: "maya.chen@example.com", photoURL: null }),
    userProfile: computed(() => ({ billingProfile: billing.value })),
    logout,
  }),
}));
vi.mock("@/composables/useAiAllowance", () => ({
  useAiAllowance: () => ({
    allowance: computed(() => getAllowanceState(billing.value, new Date("2026-09-25T12:00:00Z"))),
  }),
}));
vi.mock("@/composables/useProSubscription", () => ({
  useProSubscription: () => ({ isOpeningPortal: ref(false), openBillingPortal: vi.fn() }),
}));
vi.mock("@/composables/useJobApplicationsData", () => ({
  useJobApplicationsData: () => ({
    jobApplications: ref([{ status: "draft" }, { status: "applied" }, { status: "rejected" }, { status: "archived" }]),
  }),
}));

import AppSidebar from "../AppSidebar.vue";
import MobileTabBar from "../MobileTabBar.vue";
import AccountMenu from "../AccountMenu.vue";

enableAutoUnmount(afterEach);

const Stub = defineComponent({ template: "<div />" });
const makeRouter = () =>
  createRouter({
    history: createMemoryHistory("/app/"),
    routes: ["/", "/jobs", "/jobs/:jobId", "/documents", "/settings", "/settings/plan", "/settings/email"].map((path) => ({
      path,
      component: Stub,
    })),
  });

const mountAt = async (component: object, path: string) => {
  const router = makeRouter();
  await router.push(path);
  const wrapper = mount(component, { global: { plugins: [router] }, attachTo: document.body });
  await flushPromises();
  return { wrapper, router };
};

describe("isNavActive", () => {
  it("keeps a section active on its sub-pages only", () => {
    expect(isNavActive("/jobs", "/jobs")).toBe(true);
    expect(isNavActive("/jobs/abc", "/jobs")).toBe(true);
    expect(isNavActive("/jobsearch", "/jobs")).toBe(false);
    expect(isNavActive("/settings/email", "/settings")).toBe(true);
  });
});

describe("AppSidebar", () => {
  beforeEach(() => {
    billing.value = { aiUsage: { period: "2026-09", count: 3 } };
  });

  it("links Jobs and Documents and marks the current section", async () => {
    const { wrapper } = await mountAt(AppSidebar, "/jobs/abc");
    const links = wrapper.findAll('nav[aria-label="Main"] a');
    expect(links.map((link) => link.attributes("href"))).toEqual(["/app/jobs", "/app/documents"]);
    expect(links[0].attributes("aria-current")).toBe("page");
    expect(links[1].attributes("aria-current")).toBeUndefined();
  });

  it("counts jobs that aren't closed", async () => {
    const { wrapper } = await mountAt(AppSidebar, "/documents");
    expect(wrapper.find('nav[aria-label="Main"] a').text()).toContain("2");
  });

  it("shows AI checks left in place of coins, linking to the plan page", async () => {
    const { wrapper } = await mountAt(AppSidebar, "/jobs");
    const meter = wrapper.find('a[href="/app/settings/plan"]');
    expect(meter.text()).toContain("12 of 15 left");
    expect(wrapper.text()).not.toMatch(/coin/i);
  });

  it("shows bonus checks from old coins", async () => {
    billing.value = { aiUsage: { period: "2026-09", count: 3 }, bonusChecks: 9 };
    const { wrapper } = await mountAt(AppSidebar, "/jobs");
    expect(wrapper.text()).toContain("+ 9 bonus");
  });
});

describe("MobileTabBar", () => {
  it("has Jobs, Documents and Me, with Me active in settings", async () => {
    const { wrapper } = await mountAt(MobileTabBar, "/settings/email");
    const links = wrapper.findAll("a");
    expect(links.map((link) => link.text())).toEqual(["Jobs", "Documents", "Me"]);
    expect(links[2].attributes("href")).toBe("/app/settings");
    expect(links[2].attributes("aria-current")).toBe("page");
    expect(links[0].attributes("aria-current")).toBeUndefined();
  });
});

describe("AccountMenu", () => {
  const open = async () => {
    const mounted = await mountAt(AccountMenu, "/jobs");
    const trigger = mounted.wrapper.find("button");
    await trigger.trigger("keydown", { key: "Enter" });
    await flushPromises();
    return mounted;
  };

  it("shows the name and plan on the button", async () => {
    const { wrapper } = await mountAt(AccountMenu, "/jobs");
    expect(wrapper.find("button").text()).toContain("Maya Chen");
    expect(wrapper.find("button").text()).toContain("Free plan");
    expect(wrapper.find("button").text()).toContain("MC");
  });

  it("lists settings, help, GitHub and sign out", async () => {
    await open();
    const items = [...document.body.querySelectorAll('[role="menuitem"]')].map((item) => item.textContent?.trim());
    expect(items).toEqual(["Settings", "Help and feedback", "GitHub", "Sign out"]);
    expect(document.body.textContent).toContain("maya.chen@example.com");
  });

  it("signs out and goes to the sign-in page", async () => {
    const { router } = await open();
    const signOut = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      (item) => item.textContent?.includes("Sign out"),
    )!;
    signOut.click();
    await flushPromises();
    expect(logout).toHaveBeenCalled();
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe("/"));
  });
});
