import { describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";

const replace = vi.fn();
const push = vi.fn();
vi.mock("vue-router", () => ({
  useRouter: () => ({ replace, push }),
  useRoute: () => ({ query: {} }),
}));

const startIngestion = vi.fn();
vi.mock("@/composables/useJobIngestion", () => ({
  useJobIngestion: () => ({ start: startIngestion, errorMessage: ref(null) }),
}));

const trackEvent = vi.fn();
vi.mock("@/analytics", () => ({ trackEvent: (...args: unknown[]) => trackEvent(...args) }));

const DESCRIPTION = "Senior Frontend Engineer at Acme.\n\nYou'll own our design system and onboarding flows.\n".repeat(4);

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
      expect(wrapper.find("input").exists()).toBe(true);
      expect(wrapper.find('a[href*="chromewebstore"]').exists()).toBe(false);
    }
  });

  it("lets extension users switch to pasting", async () => {
    const wrapper = mountPrompt({ extensionUrl: STORE, desktopChromium: true });
    await wrapper.findAll("button").find((button) => button.text().includes("paste a link or description"))!.trigger("click");
    expect(wrapper.find("input").exists()).toBe(true);
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

  it("sends a LinkedIn link to the dialog, which asks for the description", async () => {
    replace.mockClear();
    const wrapper = mountPrompt({ desktopChromium: false });
    await wrapper.find("input").setValue("https://www.linkedin.com/jobs/view/4012345678/");
    await wrapper.find("form").trigger("submit");
    expect(replace).toHaveBeenCalledWith({
      query: { "dialog-name": "add-job-application", "job-link": "https://www.linkedin.com/jobs/view/4012345678/" },
    });
    expect(startIngestion).not.toHaveBeenCalled();
  });

  it("moves a pasted description into a text box", async () => {
    const wrapper = mountPrompt({ desktopChromium: false });
    await wrapper.find("input").trigger("paste", { clipboardData: { getData: () => DESCRIPTION } });
    expect(wrapper.find("input").exists()).toBe(false);
    expect((wrapper.find("textarea").element as HTMLTextAreaElement).value).toBe(DESCRIPTION.trim());
  });

  it("parses a pasted description and opens the new job form", async () => {
    push.mockClear();
    startIngestion.mockResolvedValueOnce("pastedJob12345");
    const wrapper = mountPrompt({ desktopChromium: false });
    // Typed rather than pasted, so it stays in the one-line input
    const typed = DESCRIPTION.replace(/\n+/g, " ").trim();
    await wrapper.find("input").setValue(typed);
    await wrapper.find("form").trigger("submit");
    await flushPromises();
    expect(startIngestion).toHaveBeenCalledWith({ text: typed });
    expect(trackEvent).toHaveBeenCalledWith("job_input_submitted", { input: "text", surface: "first_run" });
    expect(push).toHaveBeenCalledWith("/jobs/new?job=pastedJob12345");
  });

  it("asks for more than a few words", async () => {
    const wrapper = mountPrompt({ desktopChromium: false });
    await wrapper.find("input").setValue("frontend engineer");
    await wrapper.find("form").trigger("submit");
    expect(wrapper.find("[role=alert]").text()).toContain("whole job description");
    expect(startIngestion).not.toHaveBeenCalledWith({ text: "frontend engineer" });
  });

  it("has no spreadsheet import (owner: one action on first run)", () => {
    expect(mountPrompt({ desktopChromium: false }).text()).not.toMatch(/import/i);
  });
});
