import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// `firebase deploy` in CI is non-interactive and fails on any declared param
// missing from the FIREBASE_ENV dotenv file, even one with a default. Only
// keys known to be in that secret may be declared; read optional settings
// from process.env instead.
const PARAMS_IN_DEPLOY_ENV = [
  "GEMINI_API_KEY",
  "RESEND_API_KEY",
  "STRIPE_API_KEY",
  "STRIPE_WEBHOOK_SECRET",
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe("deploy params", () => {
  it("only declares params that the deploy env file provides", () => {
    const declared = new Set<string>();
    for (const file of sourceFiles(join(__dirname, ".."))) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/define(?:String|Int|Boolean|List|Secret)\(\s*["']([A-Z0-9_]+)["']/g)) {
        declared.add(match[1]);
      }
    }

    expect(declared.size).toBeGreaterThan(0);
    expect([...declared].filter((name) => !PARAMS_IN_DEPLOY_ENV.includes(name))).toEqual([]);
  });
});
