import { describe, it, expect, vi, beforeEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

const mockSendSignInCode = vi.fn();
const mockVerifySignInCode = vi.fn();
vi.mock("@/composables/useAuth", () => ({
  useAuth: () => ({
    sendSignInCode: mockSendSignInCode,
    verifySignInCode: mockVerifySignInCode,
  }),
}));

import EmailCodeForm from "../EmailCodeForm.vue";

async function requestCode(wrapper: ReturnType<typeof mount>, email = "sam@example.com") {
  await wrapper.get('input[type="email"]').setValue(email);
  await wrapper.get("form").trigger("submit");
  await flushPromises();
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSendSignInCode.mockResolvedValue({ success: true });
  mockVerifySignInCode.mockResolvedValue({ success: true, user: { uid: "u1" } });
});

describe("EmailCodeForm", () => {
  it("asks for the code after sending it", async () => {
    const wrapper = mount(EmailCodeForm, { props: { source: "direct" } });
    await requestCode(wrapper, " sam@example.com ");

    expect(mockSendSignInCode).toHaveBeenCalledWith("sam@example.com");
    expect(wrapper.text()).toContain("sam@example.com");
    const codeInput = wrapper.get('input[autocomplete="one-time-code"]');
    expect(codeInput.attributes("inputmode")).toBe("numeric");
  });

  it("verifies the code and emits signed-in", async () => {
    const wrapper = mount(EmailCodeForm, { props: { source: "extension" } });
    await requestCode(wrapper);

    await wrapper.get('input[autocomplete="one-time-code"]').setValue("123 456");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(mockVerifySignInCode).toHaveBeenCalledWith("sam@example.com", "123 456", { source: "extension" });
    expect(wrapper.emitted("signed-in")).toHaveLength(1);
  });

  it("shows a send error and stays on the email step", async () => {
    mockSendSignInCode.mockResolvedValue({ success: false, error: "Too many codes requested." });
    const wrapper = mount(EmailCodeForm);
    await requestCode(wrapper);

    expect(wrapper.get('[role="alert"]').text()).toContain("Too many codes requested.");
    expect(wrapper.find('input[autocomplete="one-time-code"]').exists()).toBe(false);
  });

  it("shows a wrong-code error without emitting", async () => {
    mockVerifySignInCode.mockResolvedValue({ success: false, error: "That code is wrong or expired." });
    const wrapper = mount(EmailCodeForm);
    await requestCode(wrapper);

    await wrapper.get('input[autocomplete="one-time-code"]').setValue("000000");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain("That code is wrong or expired.");
    expect(wrapper.emitted("signed-in")).toBeUndefined();
  });

  it("goes back to the email step", async () => {
    const wrapper = mount(EmailCodeForm);
    await requestCode(wrapper);

    const back = wrapper.findAll("button").find((button) => button.text() === "Use a different email");
    await back!.trigger("click");

    expect(wrapper.find('input[type="email"]').exists()).toBe(true);
  });

  it("resends the code", async () => {
    vi.useFakeTimers();
    const wrapper = mount(EmailCodeForm);
    await requestCode(wrapper);

    const resend = () => wrapper.findAll("button").find((button) => button.text().startsWith("Resend"))!;
    expect(resend().attributes("disabled")).toBeDefined();

    vi.advanceTimersByTime(30_000);
    await flushPromises();
    await resend().trigger("click");
    await flushPromises();

    expect(mockSendSignInCode).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});

describe("EmailCodeForm when the code service is down", () => {
  it.each(["functions/not-found", "functions/internal", "functions/unavailable"])(
    "emits unavailable with the email when sending fails with %s",
    async (code) => {
      mockSendSignInCode.mockResolvedValue({ success: false, error: "Something went wrong.", code });
      const wrapper = mount(EmailCodeForm);
      await requestCode(wrapper, " sam@example.com ");

      expect(wrapper.emitted("unavailable")).toEqual([["sam@example.com"]]);
    },
  );

  it("emits unavailable when verifying fails with internal", async () => {
    mockVerifySignInCode.mockResolvedValue({
      success: false,
      error: "We couldn't sign you in.",
      code: "functions/internal",
    });
    const wrapper = mount(EmailCodeForm);
    await requestCode(wrapper);
    await wrapper.get('input[autocomplete="one-time-code"]').setValue("123456");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(wrapper.emitted("unavailable")).toEqual([["sam@example.com"]]);
  });

  it.each(["functions/invalid-argument", "functions/resource-exhausted"])(
    "keeps the code flow for %s",
    async (code) => {
      mockSendSignInCode.mockResolvedValue({ success: false, error: "Too many codes requested.", code });
      const wrapper = mount(EmailCodeForm);
      await requestCode(wrapper);

      expect(wrapper.emitted("unavailable")).toBeUndefined();
      expect(wrapper.get('[role="alert"]').text()).toContain("Too many codes requested.");
    },
  );
});
