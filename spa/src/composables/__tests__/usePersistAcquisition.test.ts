import { describe, it, expect, vi } from "vitest";

vi.mock("@/firebase/config", () => ({ db: "mock-db" }));
vi.mock("@/composables/useAuth", () => ({ useAuth: vi.fn() }));

import { acquisitionToPersist, createAcquisitionGate, isNewAccount } from "../usePersistAcquisition";

const now = Date.parse("2026-09-23T12:00:00.000Z");
const acquisition = { utm_source: "reddit", landing_path: "/app/", captured_at: "2026-09-23T10:00:00.000Z" };
const newUser = { isAnonymous: false, metadata: { creationTime: "Wed, 23 Sep 2026 11:59:00 GMT" } };

describe("isNewAccount", () => {
  it("accepts accounts created in the last 24 hours", () => {
    expect(isNewAccount(newUser, now)).toBe(true);
  });

  it("rejects older or unknown creation times", () => {
    expect(isNewAccount({ metadata: { creationTime: "Mon, 21 Sep 2026 11:59:00 GMT" } }, now)).toBe(false);
    expect(isNewAccount({ metadata: {} }, now)).toBe(false);
  });
});

describe("acquisitionToPersist", () => {
  it("returns the stored acquisition for a new account without one", () => {
    expect(acquisitionToPersist(newUser, null, acquisition, now)).toEqual(acquisition);
    expect(acquisitionToPersist(newUser, { createdAt: "x" }, acquisition, now)).toEqual(acquisition);
  });

  it("waits for the profile to load", () => {
    expect(acquisitionToPersist(newUser, undefined, acquisition, now)).toBeNull();
  });

  it("never overwrites an existing acquisition", () => {
    expect(acquisitionToPersist(newUser, { acquisition: {} }, acquisition, now)).toBeNull();
  });

  it("skips anonymous, signed-out, and old accounts", () => {
    expect(acquisitionToPersist({ ...newUser, isAnonymous: true }, null, acquisition, now)).toBeNull();
    expect(acquisitionToPersist(null, null, acquisition, now)).toBeNull();
    const oldUser = { isAnonymous: false, metadata: { creationTime: "Mon, 01 Jun 2026 00:00:00 GMT" } };
    expect(acquisitionToPersist(oldUser, null, acquisition, now)).toBeNull();
  });

  it("returns null when nothing was captured", () => {
    expect(acquisitionToPersist(newUser, null, null, now)).toBeNull();
  });
});

describe("createAcquisitionGate", () => {
  const user = { ...newUser, uid: "user-1" };

  it("writes once for a new account", () => {
    const nextWrite = createAcquisitionGate();
    expect(nextWrite(user, null, acquisition, now)).toEqual(acquisition);
    expect(nextWrite(user, { createdAt: "x" }, acquisition, now)).toBeNull();
  });

  it("does not bring back a profile that was just deleted", () => {
    const nextWrite = createAcquisitionGate();
    expect(nextWrite(user, { acquisition: {} }, acquisition, now)).toBeNull();
    expect(nextWrite(user, null, acquisition, now)).toBeNull();
  });

  it("still writes when the profile appears without an acquisition", () => {
    const nextWrite = createAcquisitionGate();
    expect(nextWrite(user, undefined, acquisition, now)).toBeNull();
    expect(nextWrite(user, { createdAt: "x" }, acquisition, now)).toEqual(acquisition);
  });
});
