import { describe, it, expect, vi, beforeEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

const mockLogin = vi.fn();
const mockRegister = vi.fn();
vi.mock("@/composables/useAuth", () => ({
  useAuth: () => ({
    login: mockLogin,
    register: mockRegister,
    loginWithGoogle: vi.fn(),
    resetPassword: vi.fn(),
    sendSignInCode: vi.fn(),
    verifySignInCode: vi.fn(),
  }),
}));

const mockRedirect = vi.fn();
vi.mock("@/composables/usePostAuthRedirect", () => ({
  usePostAuthRedirect: () => ({ redirect: mockRedirect }),
}));

import SignInForm from "../SignInForm.vue";
import SignUpForm from "../SignUpForm.vue";
import EmailCodeForm from "../EmailCodeForm.vue";

beforeEach(() => {
  vi.clearAllMocks();
  mockLogin.mockResolvedValue({ success: true, user: { uid: "u1" } });
  mockRegister.mockResolvedValue({ success: true, user: { uid: "u2" } });
});

function buttonByText(wrapper: ReturnType<typeof mount>, text: string) {
  return wrapper.findAll("button").find((button) => button.text() === text);
}

describe("SignUpForm", () => {
  it("offers the code form first with a password sign-up link", () => {
    const wrapper = mount(SignUpForm);
    expect(wrapper.findComponent(EmailCodeForm).exists()).toBe(true);
    expect(wrapper.find('input[type="password"]').exists()).toBe(false);
    expect(buttonByText(wrapper, "Sign up with a password instead")).toBeDefined();
  });

  it("signs up with a password from the fallback link", async () => {
    const wrapper = mount(SignUpForm, { props: { source: "extension" } });
    await buttonByText(wrapper, "Sign up with a password instead")!.trigger("click");

    await wrapper.get("#signup-email").setValue("sam@example.com");
    await wrapper.get("#signup-password").setValue("secret1");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(mockRegister).toHaveBeenCalledWith("sam@example.com", "secret1", { source: "extension" });
    expect(mockRedirect).toHaveBeenCalled();
  });

  it("switches to password sign-up with the email filled in when codes are unavailable", async () => {
    const wrapper = mount(SignUpForm);
    wrapper.findComponent(EmailCodeForm).vm.$emit("unavailable", "sam@example.com");
    await flushPromises();

    expect(wrapper.findComponent(EmailCodeForm).exists()).toBe(false);
    expect((wrapper.get("#signup-email").element as HTMLInputElement).value).toBe("sam@example.com");
    expect(wrapper.get('[role="status"]').text()).toContain("password");
  });
});

describe("SignInForm", () => {
  it("switches to password sign-in with the email filled in when codes are unavailable", async () => {
    const wrapper = mount(SignInForm);
    wrapper.findComponent(EmailCodeForm).vm.$emit("unavailable", "sam@example.com");
    await flushPromises();

    expect(wrapper.findComponent(EmailCodeForm).exists()).toBe(false);
    expect((wrapper.get("#signin-email").element as HTMLInputElement).value).toBe("sam@example.com");
    expect(wrapper.get('[role="status"]').text()).toContain("password");
  });
});
