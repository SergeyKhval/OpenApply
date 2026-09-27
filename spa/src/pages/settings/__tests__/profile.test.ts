import { describe, expect, it, vi, beforeEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

const { currentUser, updateProfile } = vi.hoisted(() => ({
  currentUser: { value: null as null | { displayName: string | null; email: string; photoURL: string | null } },
  updateProfile: vi.fn(),
}));
vi.mock("vuefire", async () => {
  const { ref: vueRef } = await import("vue");
  return { useCurrentUser: () => vueRef(currentUser.value), updateCurrentUserProfile: updateProfile };
});
vi.mock("@/composables/useAuth", async () => {
  const { ref: vueRef } = await import("vue");
  return { useAuth: () => ({ userProfile: vueRef(null) }) };
});

import ProfilePage from "../profile.vue";

const mountPage = () => mount(ProfilePage, { global: { stubs: { SettingsShell: { template: "<div><slot /></div>" } } } });

describe("Settings > Profile", () => {
  beforeEach(() => {
    currentUser.value = { displayName: "Maya Chen", email: "maya.chen@example.com", photoURL: null };
    updateProfile.mockReset().mockResolvedValue(undefined);
  });

  it("shows initials, name, email and plan, with the email read-only", () => {
    const wrapper = mountPage();
    expect(wrapper.text()).toContain("MC");
    expect(wrapper.text()).toContain("maya.chen@example.com · Free plan");
    expect(wrapper.findAll("input")).toHaveLength(1);
    expect((wrapper.find("#profile-name").element as HTMLInputElement).value).toBe("Maya Chen");
  });

  it("saves a tidied name, and only when it changed", async () => {
    const wrapper = mountPage();
    const save = wrapper.find("button[type=submit]");
    expect(save.attributes("disabled")).toBeDefined();
    await wrapper.find("#profile-name").setValue("  Maya   Chen-Ortiz ");
    await wrapper.find("form").trigger("submit");
    await flushPromises();
    expect(updateProfile).toHaveBeenCalledWith({ displayName: "Maya Chen-Ortiz" });
    expect(wrapper.text()).toContain("Saved.");
  });

  it("clears the name when the field is emptied", async () => {
    const wrapper = mountPage();
    await wrapper.find("#profile-name").setValue("   ");
    await wrapper.find("form").trigger("submit");
    await flushPromises();
    expect(updateProfile).toHaveBeenCalledWith({ displayName: null });
  });

  it("refuses a name that is too long", async () => {
    const wrapper = mountPage();
    await wrapper.find("#profile-name").setValue("a".repeat(81));
    await wrapper.find("form").trigger("submit");
    expect(updateProfile).not.toHaveBeenCalled();
    expect(wrapper.find("[role=alert]").text()).toBe("Keep it under 80 characters.");
  });

  it("says so when saving fails", async () => {
    updateProfile.mockRejectedValue(new Error("network"));
    const wrapper = mountPage();
    await wrapper.find("#profile-name").setValue("Maya");
    await wrapper.find("form").trigger("submit");
    await flushPromises();
    expect(wrapper.find("[role=alert]").text()).toBe("Couldn't save your name. Try again.");
  });
});
