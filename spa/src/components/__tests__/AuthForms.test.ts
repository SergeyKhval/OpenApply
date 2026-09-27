import { describe, it, expect, vi, beforeEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

const mockLoginWithGoogle = vi.fn();
const mockSendSignInCode = vi.fn();
vi.mock("@/composables/useAuth", () => ({
  useAuth: () => ({
    loginWithGoogle: mockLoginWithGoogle,
    sendSignInCode: mockSendSignInCode,
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
  mockLoginWithGoogle.mockResolvedValue({ success: true, user: { uid: "u1" } });
  mockSendSignInCode.mockResolvedValue({ success: true });
});

function buttonByText(wrapper: ReturnType<typeof mount>, text: string) {
  return wrapper.findAll("button").find((button) => button.text() === text);
}

const serviceDown = { success: false, error: "internal", code: "functions/unavailable" };

describe.each([
  ["SignInForm", SignInForm, "signin"],
  ["SignUpForm", SignUpForm, "signup"],
] as const)("%s", (_name, Form, idPrefix) => {
  it("offers only Google and an emailed code, never a password", () => {
    const wrapper = mount(Form);
    expect(wrapper.findComponent(EmailCodeForm).exists()).toBe(true);
    expect(wrapper.find('input[type="password"]').exists()).toBe(false);
    // The only mention says there isn't one
    expect(wrapper.text()).not.toMatch(/forgot|your password|reset password/i);
    expect(wrapper.text()).toContain("No password. New or returning, it is the same step.");
  });

  it("puts the emailed code first and Google second, as on the canvas", () => {
    const wrapper = mount(Form);
    const google = buttonByText(wrapper, "Continue with Google")!;
    expect(google.classes().join(" ")).toMatch(/border/);
    const sendCode = buttonByText(wrapper, "Email me a code")!;
    expect(sendCode.attributes("type")).toBe("submit");
    expect(sendCode.classes().join(" ")).toContain("bg-primary");
    expect(wrapper.get(`#${idPrefix}-email`).attributes("placeholder")).toBe("you@example.com");
  });

  it("links the terms and privacy policy", () => {
    const wrapper = mount(Form);
    const links = wrapper.findAll("a").map((link) => link.attributes("href"));
    expect(links).toEqual(["/terms", "/privacy"]);
  });

  it("shows a retry and Google option when the code service is down", async () => {
    mockSendSignInCode.mockResolvedValueOnce(serviceDown);
    const wrapper = mount(Form, { props: { source: "extension" } });

    await wrapper.get(`#${idPrefix}-email`).setValue("sam@example.com");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(wrapper.findComponent(EmailCodeForm).exists()).toBe(true);
    expect(wrapper.find('input[type="password"]').exists()).toBe(false);
    expect(wrapper.get('[role="alert"]').text()).toContain("isn't working right now");

    await buttonByText(wrapper, "Sign in with Google")!.trigger("click");
    await flushPromises();
    expect(mockLoginWithGoogle).toHaveBeenCalledWith({ source: "extension" });
    expect(mockRedirect).toHaveBeenCalled();
  });

  it("retries sending the code and moves on once it works", async () => {
    mockSendSignInCode.mockResolvedValueOnce(serviceDown);
    const wrapper = mount(Form);

    await wrapper.get(`#${idPrefix}-email`).setValue("sam@example.com");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    await buttonByText(wrapper, "Try again")!.trigger("click");
    await flushPromises();

    expect(mockSendSignInCode).toHaveBeenCalledTimes(2);
    expect(mockSendSignInCode).toHaveBeenLastCalledWith("sam@example.com");
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.find(`#${idPrefix}-code`).exists()).toBe(true);
  });
});

describe("headings", () => {
  it("sign up asks to create a free account, sign in welcomes back", () => {
    expect(mount(SignUpForm).get("h2").text()).toBe("Create your free account");
    expect(mount(SignInForm).get("h2").text()).toBe("Sign in");
  });
});
