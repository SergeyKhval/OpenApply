import { describe, expect, it } from "vitest";
import { emulatorPorts } from "../emulatorPorts";

describe("emulatorPorts", () => {
  it("defaults to the firebase.json ports", () => {
    expect(emulatorPorts({})).toEqual({
      auth: 9099,
      firestore: 8080,
      functions: 5001,
      storage: 9199,
    });
  });

  it("reads VITE_*_EMULATOR_PORT overrides", () => {
    expect(
      emulatorPorts({
        VITE_FIRESTORE_EMULATOR_PORT: "8085",
        VITE_AUTH_EMULATOR_PORT: "9098",
      }),
    ).toEqual({ auth: 9098, firestore: 8085, functions: 5001, storage: 9199 });
  });

  it("ignores values that are not ports", () => {
    expect(emulatorPorts({ VITE_FIRESTORE_EMULATOR_PORT: "abc" }).firestore).toBe(8080);
    expect(emulatorPorts({ VITE_AUTH_EMULATOR_PORT: "-1" }).auth).toBe(9099);
  });
});
