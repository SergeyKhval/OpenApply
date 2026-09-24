import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks (hoisted before imports) ---

vi.mock("firebase-functions/v2/https", () => {
  class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  }
  // Unwrap callables so tests call the handler directly
  return { HttpsError, onCall: (_options: unknown, handler: unknown) => handler };
});

vi.mock("firebase-functions", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("firebase-functions/params", () => ({
  defineString: (name: string) => ({
    value: () => (name === "RESEND_API_KEY" ? "test-resend-key" : "test-hash-key"),
  }),
}));

const mockSend = vi.fn();
vi.mock("resend", () => {
  const ResendMock = function (this: unknown) {
    (this as { emails: { send: typeof mockSend } }).emails = { send: mockSend };
  };
  return { Resend: ResendMock };
});

// In-memory Firestore. Transaction writes are buffered and dropped when the
// transaction callback throws, like the real thing.
const store = new Map<string, Record<string, unknown>>();
type Increment = { __increment: number };
const isIncrement = (value: unknown): value is Increment =>
  typeof value === "object" && value !== null && "__increment" in value;

function applyWrite(path: string, data: Record<string, unknown>, merge: boolean) {
  const current = merge ? { ...(store.get(path) ?? {}) } : {};
  for (const [key, value] of Object.entries(data)) {
    current[key] = isIncrement(value)
      ? ((current[key] as number | undefined) ?? 0) + value.__increment
      : value;
  }
  store.set(path, current);
}

function docRef(path: string) {
  return {
    path,
    get: async () => ({ exists: store.has(path), data: () => store.get(path) }),
    set: async (data: Record<string, unknown>) => applyWrite(path, data, false),
    delete: async () => {
      store.delete(path);
    },
  };
}
type DocRef = ReturnType<typeof docRef>;

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: (name: string) => ({ doc: (id: string) => docRef(`${name}/${id}`) }),
    runTransaction: async (fn: (transaction: unknown) => Promise<unknown>) => {
      const writes: Array<() => void> = [];
      const transaction = {
        get: async (ref: DocRef) => ref.get(),
        set: (ref: DocRef, data: Record<string, unknown>, options?: { merge?: boolean }) => {
          writes.push(() => applyWrite(ref.path, data, Boolean(options?.merge)));
        },
        update: (ref: DocRef, data: Record<string, unknown>) => {
          writes.push(() => applyWrite(ref.path, data, true));
        },
        delete: (ref: DocRef) => {
          writes.push(() => store.delete(ref.path));
        },
      };
      const result = await fn(transaction);
      writes.forEach((write) => write());
      return result;
    },
  }),
  FieldValue: {
    increment: (n: number): Increment => ({ __increment: n }),
    serverTimestamp: () => "server-timestamp",
  },
  Timestamp: {
    fromMillis: (ms: number) => ({ toMillis: () => ms }),
  },
}));

const mockGetUserByEmail = vi.fn();
const mockCreateUser = vi.fn();
const mockUpdateUser = vi.fn();
const mockCreateCustomToken = vi.fn();
vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({
    getUserByEmail: mockGetUserByEmail,
    createUser: mockCreateUser,
    updateUser: mockUpdateUser,
    createCustomToken: mockCreateCustomToken,
  }),
}));

import { sendSignInCode, verifySignInCode } from "../signInCode";
import { INVALID_CODE_MESSAGE, MAX_ATTEMPTS } from "../lib/signInCode";

type Handler = (request: unknown) => Promise<unknown>;
const send = sendSignInCode as unknown as Handler;
const verify = verifySignInCode as unknown as Handler;

function request(data: Record<string, unknown>, ip = "203.0.113.7") {
  return { data, rawRequest: { headers: { "x-forwarded-for": ip }, ip } };
}

function codeDocs() {
  return [...store.entries()].filter(([path]) => path.startsWith("signInCodes/"));
}

function lastEmailedCode(): string {
  const [message] = mockSend.mock.calls.at(-1) as [{ text: string }];
  const match = message.text.match(/\b(\d{6})\b/);
  if (!match) throw new Error("no code in email");
  return match[1];
}

function wrongCode(code: string) {
  return code === "000000" ? "000001" : "000000";
}

async function expectInvalidCode(promise: Promise<unknown>) {
  await expect(promise).rejects.toMatchObject({
    code: "invalid-argument",
    message: INVALID_CODE_MESSAGE,
  });
}

const notFound = Object.assign(new Error("no user"), { code: "auth/user-not-found" });

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
  vi.useRealTimers();
  delete process.env.FUNCTIONS_EMULATOR;
  mockSend.mockResolvedValue({ data: { id: "email-id" }, error: null });
  mockGetUserByEmail.mockResolvedValue({ uid: "existing-uid", emailVerified: true, disabled: false });
  mockCreateUser.mockResolvedValue({ uid: "new-uid" });
  mockCreateCustomToken.mockImplementation(async (uid: string) => `token-for-${uid}`);
});

describe("sendSignInCode", () => {
  it("emails a 6-digit code and stores only its hash", async () => {
    await expect(send(request({ email: "Sam@Example.com" }))).resolves.toEqual({ sent: true });

    expect(mockSend).toHaveBeenCalledTimes(1);
    const [message] = mockSend.mock.calls[0] as [{ to: string; subject: string }];
    expect(message.to).toBe("sam@example.com");
    const code = lastEmailedCode();
    expect(message.subject).toContain(code);

    const docs = codeDocs();
    expect(docs).toHaveLength(1);
    const [path, stored] = docs[0];
    expect(path).not.toContain("sam@example.com");
    expect(JSON.stringify(stored)).not.toContain(code);
    expect(stored.attempts).toBe(0);
  });

  it("never looks up the account, so the response can't reveal whether it exists", async () => {
    await send(request({ email: "sam@example.com" }));
    expect(mockGetUserByEmail).not.toHaveBeenCalled();
  });

  it("uses one code doc for the same email in any case", async () => {
    await send(request({ email: "sam@example.com" }));
    await send(request({ email: "  SAM@example.COM " }));
    expect(codeDocs()).toHaveLength(1);
  });

  it("rejects an invalid email", async () => {
    await expect(send(request({ email: "nope" }))).rejects.toMatchObject({ code: "invalid-argument" });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("limits sends per email", async () => {
    for (let i = 0; i < 5; i++) {
      await send(request({ email: "sam@example.com" }, `203.0.113.${i}`));
    }
    await expect(send(request({ email: "sam@example.com" }, "203.0.113.99"))).rejects.toMatchObject({
      code: "resource-exhausted",
    });
    expect(mockSend).toHaveBeenCalledTimes(5);
  });

  it("limits sends per IP across different emails", async () => {
    for (let i = 0; i < 20; i++) {
      await send(request({ email: `person${i}@example.com` }));
    }
    await expect(send(request({ email: "one-more@example.com" }))).rejects.toMatchObject({
      code: "resource-exhausted",
    });
  });

  it("removes the code when the email can't be sent", async () => {
    mockSend.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(send(request({ email: "sam@example.com" }))).rejects.toMatchObject({ code: "internal" });
    expect(codeDocs()).toHaveLength(0);
  });

  it("removes the code when Resend throws", async () => {
    mockSend.mockRejectedValue(new Error("network"));
    await expect(send(request({ email: "sam@example.com" }))).rejects.toMatchObject({ code: "internal" });
    expect(codeDocs()).toHaveLength(0);
  });

  it("logs the code instead of emailing it in the emulator", async () => {
    process.env.FUNCTIONS_EMULATOR = "true";
    await expect(send(request({ email: "sam@example.com" }))).resolves.toEqual({ sent: true });
    expect(mockSend).not.toHaveBeenCalled();
    expect(codeDocs()).toHaveLength(1);
  });
});

describe("verifySignInCode", () => {
  it("signs an existing account in to its own uid", async () => {
    await send(request({ email: "sam@example.com" }));
    const code = lastEmailedCode();

    await expect(verify(request({ email: "Sam@Example.com", code }))).resolves.toEqual({
      token: "token-for-existing-uid",
      isNewUser: false,
    });
    expect(mockGetUserByEmail).toHaveBeenCalledWith("sam@example.com");
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(codeDocs()).toHaveLength(0);
  });

  it("accepts a code pasted with a space", async () => {
    await send(request({ email: "sam@example.com" }));
    const code = lastEmailedCode();
    await expect(
      verify(request({ email: "sam@example.com", code: `${code.slice(0, 3)} ${code.slice(3)}` })),
    ).resolves.toMatchObject({ isNewUser: false });
  });

  it("creates a verified account for a new email", async () => {
    mockGetUserByEmail.mockRejectedValue(notFound);
    await send(request({ email: "new@example.com" }));

    await expect(verify(request({ email: "new@example.com", code: lastEmailedCode() }))).resolves.toEqual({
      token: "token-for-new-uid",
      isNewUser: true,
    });
    expect(mockCreateUser).toHaveBeenCalledWith({ email: "new@example.com", emailVerified: true });
  });

  it("marks an unverified password account as verified", async () => {
    mockGetUserByEmail.mockResolvedValue({ uid: "pw-uid", emailVerified: false, disabled: false });
    await send(request({ email: "sam@example.com" }));

    await verify(request({ email: "sam@example.com", code: lastEmailedCode() }));
    expect(mockUpdateUser).toHaveBeenCalledWith("pw-uid", { emailVerified: true });
  });

  it("refuses a disabled account", async () => {
    mockGetUserByEmail.mockResolvedValue({ uid: "off-uid", emailVerified: true, disabled: true });
    await send(request({ email: "sam@example.com" }));

    await expect(
      verify(request({ email: "sam@example.com", code: lastEmailedCode() })),
    ).rejects.toMatchObject({ code: "permission-denied" });
    expect(mockCreateCustomToken).not.toHaveBeenCalled();
  });

  it("gives the same error for no code, a wrong code and an expired code", async () => {
    await expectInvalidCode(verify(request({ email: "sam@example.com", code: "123456" })));

    await send(request({ email: "sam@example.com" }));
    const code = lastEmailedCode();
    await expectInvalidCode(verify(request({ email: "sam@example.com", code: wrongCode(code) })));

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 10 * 60 * 1000 + 1);
    await expectInvalidCode(verify(request({ email: "sam@example.com", code })));
    expect(mockCreateCustomToken).not.toHaveBeenCalled();
  });

  it("counts wrong attempts and kills the code after the limit", async () => {
    await send(request({ email: "sam@example.com" }));
    const code = lastEmailedCode();

    await expectInvalidCode(verify(request({ email: "sam@example.com", code: wrongCode(code) })));
    expect(codeDocs()[0][1].attempts).toBe(1);

    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      await expectInvalidCode(verify(request({ email: "sam@example.com", code: wrongCode(code) })));
    }
    await expectInvalidCode(verify(request({ email: "sam@example.com", code })));
    expect(mockCreateCustomToken).not.toHaveBeenCalled();
  });

  it("only works once", async () => {
    await send(request({ email: "sam@example.com" }));
    const code = lastEmailedCode();
    await verify(request({ email: "sam@example.com", code }));
    await expectInvalidCode(verify(request({ email: "sam@example.com", code })));
  });

  it("stops accepting the old code once a new one is sent", async () => {
    await send(request({ email: "sam@example.com" }));
    const firstCode = lastEmailedCode();
    await send(request({ email: "sam@example.com" }));
    const secondCode = lastEmailedCode();

    if (firstCode !== secondCode) {
      await expectInvalidCode(verify(request({ email: "sam@example.com", code: firstCode })));
    }
    await expect(verify(request({ email: "sam@example.com", code: secondCode }))).resolves.toMatchObject({
      token: "token-for-existing-uid",
    });
  });

  it("does not accept a code sent to a different email", async () => {
    await send(request({ email: "sam@example.com" }));
    await expectInvalidCode(verify(request({ email: "alex@example.com", code: lastEmailedCode() })));
  });

  it("falls back to the existing account if it appears between lookup and create", async () => {
    mockGetUserByEmail
      .mockRejectedValueOnce(notFound)
      .mockResolvedValueOnce({ uid: "raced-uid", emailVerified: true, disabled: false });
    mockCreateUser.mockRejectedValue(Object.assign(new Error("exists"), { code: "auth/email-already-exists" }));
    await send(request({ email: "sam@example.com" }));

    await expect(verify(request({ email: "sam@example.com", code: lastEmailedCode() }))).resolves.toEqual({
      token: "token-for-raced-uid",
      isNewUser: false,
    });
  });
});
