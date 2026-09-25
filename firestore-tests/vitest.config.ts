import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Rules evaluation round-trips through the emulator; give it room.
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
