import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

const replace = vi.fn();
vi.mock("vue-router", () => ({
  useRouter: () => ({ replace }),
  useRoute: () => ({ query: {} }),
}));

import FirstJobApplicationPrompt from "../FirstJobApplicationPrompt.vue";

const STORE = "https://chromewebstore.google.com/detail/openapply/abc";
const mountPrompt = (props: { extensionUrl?: string; desktopChromium?: boolean }) =>
  mount(FirstJobApplicationPrompt, { props });

describe("FirstJobApplicationPrompt", () => {
  it("leads with the extension on desktop Chrome/Edge when it has a store link", () => {
    const wrapper = mountPrompt({ extensionUrl: STORE, desktopChromium: true });
    expect(wrapper.find(`a[href="${STORE}"]`).text()).toContain("Add to Chrome");
    expect(wrapper.find("input").exists()).toBe(false);
  });

  it("shows paste-a-link everywhere else, and when there is no store link yet", () => {
    for (const props of [{ extensionUrl: STORE, desktopChromium: false }, { extensionUrl: "", desktopChromium: true }]) {
      const wrapper = mountPrompt(props);
      expect(wrapper.find("input[type=url]").exists()).toBe(true);
      expect(wrapper.find('a[href*="chromewebstore"]').exists()).toBe(false);
    }
  });

  it("lets extension users switch to pasting", async () => {
    const wrapper = mountPrompt({ extensionUrl: STORE, desktopChromium: true });
    await wrapper.findAll("button").find((button) => button.text().includes("paste a link"))!.trigger("click");
    expect(wrapper.find("input[type=url]").exists()).toBe(true);
  });

  it("opens the add dialog with the pasted link, adding https:// when missing", async () => {
    replace.mockClear();
    const wrapper = mountPrompt({ desktopChromium: false });
    await wrapper.find("input").setValue("linkedin.com/jobs/view/123");
    await wrapper.find("form").trigger("submit");
    expect(replace).toHaveBeenCalledWith({
      query: { "dialog-name": "add-job-application", "job-link": "https://linkedin.com/jobs/view/123" },
    });
  });

  it("has no spreadsheet import (owner: one action on first run)", () => {
    expect(mountPrompt({ desktopChromium: false }).text()).not.toMatch(/import/i);
  });
});
