// Emulator ports default to firebase.json; VITE_*_EMULATOR_PORT overrides them
// so a second local stack can run next to the shared one.
const DEFAULT_PORTS = { auth: 9099, firestore: 8080, functions: 5001, storage: 9199 };

type Env = Record<string, string | undefined>;

const toPort = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const emulatorPorts = (env: Env) => ({
  auth: toPort(env.VITE_AUTH_EMULATOR_PORT, DEFAULT_PORTS.auth),
  firestore: toPort(env.VITE_FIRESTORE_EMULATOR_PORT, DEFAULT_PORTS.firestore),
  functions: toPort(env.VITE_FUNCTIONS_EMULATOR_PORT, DEFAULT_PORTS.functions),
  storage: toPort(env.VITE_STORAGE_EMULATOR_PORT, DEFAULT_PORTS.storage),
});
