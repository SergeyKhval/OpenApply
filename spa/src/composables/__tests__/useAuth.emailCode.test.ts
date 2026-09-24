import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = { name: "auth" };
vi.mock("vuefire", () => ({
  useFirebaseAuth: () => mockAuth,
  useCurrentUser: () => ({ value: null }),
  useDocument: () => ({ value: null }),
}));

vi.mock("@/firebase/config.ts", () => ({ db: {}, functions: { name: "functions" } }));
vi.mock("firebase/firestore", () => ({ collection: vi.fn(), doc: vi.fn() }));

const callables: Record<string, ReturnType<typeof vi.fn>> = {
  sendSignInCode: vi.fn(),
  verifySignInCode: vi.fn(),
};
vi.mock("firebase/functions", () => ({
  httpsCallable: (_functions: unknown, name: string) => callables[name],
}));

const mockSignInWithCustomToken = vi.fn();
vi.mock("firebase/auth", () => ({
  signInWithCustomToken: (...args: unknown[]) => mockSignInWithCustomToken(...args),
  getAdditionalUserInfo: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

const mockTrackEvent = vi.fn();
const mockIdentifyUser = vi.fn();
vi.mock("@/analytics", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
  identifyUser: (...args: unknown[]) => mockIdentifyUser(...args),
  resetUser: vi.fn(),
}));

import { useAuth } from "../useAuth";

function callableError(code: string, message: string) {
  return Object.assign(new Error(message), { code: `functions/${code}` });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sendSignInCode", () => {
  it("calls the function with the email", async () => {
    callables.sendSignInCode.mockResolvedValue({ data: { sent: true } });
    const { sendSignInCode } = useAuth();

    await expect(sendSignInCode("sam@example.com")).resolves.toEqual({ success: true });
    expect(callables.sendSignInCode).toHaveBeenCalledWith({ email: "sam@example.com" });
  });

  it("shows the server's message for a rate limit", async () => {
    callables.sendSignInCode.mockRejectedValue(
      callableError("resource-exhausted", "Too many codes requested."),
    );
    const { sendSignInCode } = useAuth();

    await expect(sendSignInCode("sam@example.com")).resolves.toEqual({
      success: false,
      error: "Too many codes requested.",
      code: "functions/resource-exhausted",
    });
  });

  it("hides unexpected errors behind a generic message", async () => {
    callables.sendSignInCode.mockRejectedValue(callableError("unavailable", "fetch failed"));
    const { sendSignInCode } = useAuth();

    await expect(sendSignInCode("sam@example.com")).resolves.toEqual({
      success: false,
      error: "Something went wrong. Try again.",
      code: "functions/unavailable",
    });
  });
});

describe("verifySignInCode", () => {
  it("signs in with the returned token and tracks a login", async () => {
    callables.verifySignInCode.mockResolvedValue({ data: { token: "tok", isNewUser: false } });
    const user = { uid: "u1", email: "sam@example.com" };
    mockSignInWithCustomToken.mockResolvedValue({ user });
    const { verifySignInCode } = useAuth();

    await expect(
      verifySignInCode("sam@example.com", "123456", { source: "extension" }),
    ).resolves.toEqual({ success: true, user });

    expect(callables.verifySignInCode).toHaveBeenCalledWith({ email: "sam@example.com", code: "123456" });
    expect(mockSignInWithCustomToken).toHaveBeenCalledWith(mockAuth, "tok");
    expect(mockIdentifyUser).toHaveBeenCalledWith("u1", { email: "sam@example.com", authMethod: "email_code" });
    expect(mockTrackEvent).toHaveBeenCalledWith("login_completed", { source: "extension", method: "email_code" });
  });

  it("tracks a signup for a new account", async () => {
    callables.verifySignInCode.mockResolvedValue({ data: { token: "tok", isNewUser: true } });
    mockSignInWithCustomToken.mockResolvedValue({ user: { uid: "u2", email: "new@example.com" } });
    const { verifySignInCode } = useAuth();

    await verifySignInCode("new@example.com", "123456");
    expect(mockTrackEvent).toHaveBeenCalledWith("signup_completed", { source: "direct", method: "email_code" });
  });

  it("returns the server's message for a wrong code without signing in", async () => {
    callables.verifySignInCode.mockRejectedValue(
      callableError("invalid-argument", "That code is wrong or expired. Request a new one."),
    );
    const { verifySignInCode } = useAuth();

    await expect(verifySignInCode("sam@example.com", "000000")).resolves.toEqual({
      success: false,
      error: "That code is wrong or expired. Request a new one.",
      code: "functions/invalid-argument",
    });
    expect(mockSignInWithCustomToken).not.toHaveBeenCalled();
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });
});
