#!/usr/bin/env node
// Prod smoke test (oa-ocf): HTTP + rendered-page checks against a live OpenApply
// deployment. Never submits a form (no paid AI calls) — it only loads pages and
// inspects what rendered. See scripts/smoke/run.sh for the CLI wrapper.

import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");

// puppeteer-core is a dependency of functions/, not hoisted to the workspace
// root. Anchor module resolution there instead of adding a new dependency.
const functionsRequire = createRequire(
  path.join(repoRoot, "functions", "package.json"),
);
const puppeteer = functionsRequire("puppeteer-core");

function getArg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const BASE_URL = getArg(
  "base-url",
  process.env.SMOKE_BASE_URL || "https://openapply.app",
).replace(/\/+$/, "");
const OUT_DIR = getArg("out-dir", null);
const CHROME_PATH = process.env.CHROME_PATH || "/usr/bin/google-chrome";
const TIME_BUDGET_MS = Number(process.env.SMOKE_TIME_BUDGET_MS || 60_000);

if (!OUT_DIR) {
  console.error("Usage: check.mjs --out-dir <dir> [--base-url <url>]");
  process.exit(2);
}

const screenshotsDir = path.join(OUT_DIR, "screenshots");
await fs.mkdir(screenshotsDir, { recursive: true });

const startedAt = Date.now();
const elapsed = () => Date.now() - startedAt;
const overBudget = () => elapsed() > TIME_BUDGET_MS;

const results = [];
function record(category, name, pass, detail = "") {
  results.push({ category, name, pass, detail, atMs: elapsed() });
  const tag = pass ? "PASS" : "FAIL";
  console.log(`[${tag}] ${category}: ${name}${detail ? " — " + detail : ""}`);
}

// ---------------------------------------------------------------------------
// 1. Plain HTTP 200 checks (fast, run in parallel, no browser needed)
// ---------------------------------------------------------------------------

const httpPaths = [
  "/",
  "/tools/resume-job-match",
  "/resume-keywords",
  "/blog",
  "/app/",
  "/save",
  "/sitemap-index.xml",
  "/robots.txt",
  "/llms.txt",
];

async function checkHttp(p) {
  const url = BASE_URL + p;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timer);
    await res.arrayBuffer(); // drain, so keep-alive sockets free up promptly
    record("http", p, res.status === 200, `status ${res.status}`);
  } catch (err) {
    record("http", p, false, err.message || String(err));
  }
}

await Promise.all(httpPaths.map(checkHttp));

// ---------------------------------------------------------------------------
// 2. Rendered-page checks in headless Chrome, at desktop + mobile widths
// ---------------------------------------------------------------------------

const viewports = [
  { width: 1440, height: 900, label: "1440" },
  { width: 390, height: 844, label: "390" },
];

// In-page assertion functions. Each returns { pass, detail } and must not
// depend on anything outside the DOM (they run via page.evaluate).

const assertions = {
  headerNav: () => {
    const nav = document.querySelector("header nav");
    if (!nav) return { pass: false, detail: "no <nav> inside <header>" };
    const links = nav.querySelectorAll("a");
    return { pass: links.length > 0, detail: `${links.length} nav links` };
  },
  toolForm: () => {
    const missing = [];
    if (!document.querySelector("#resume-text")) missing.push("#resume-text");
    if (!document.querySelector("#job-description"))
      missing.push("#job-description");
    if (!document.querySelector('button[type="submit"]'))
      missing.push('button[type="submit"]');
    return {
      pass: missing.length === 0,
      detail: missing.length ? `missing ${missing.join(", ")}` : "form present",
    };
  },
  signInForm: () => {
    const missing = [];
    if (!document.querySelector("#signin-email")) missing.push("#signin-email");
    if (!document.querySelector("#signin-password"))
      missing.push("#signin-password");
    if (!document.querySelector('button[type="submit"]'))
      missing.push('button[type="submit"]');
    return {
      pass: missing.length === 0,
      detail: missing.length ? `missing ${missing.join(", ")}` : "form present",
    };
  },
  saveEmptyState: () => {
    const h1 = document.querySelector("h1");
    const alert = document.querySelector('[role="alert"]');
    const text = (h1 && h1.textContent) || "";
    const pass = /couldn.?t save/i.test(text) && !!alert;
    return { pass, detail: `h1="${text.trim()}" alert=${!!alert}` };
  },
  // The icon font that broke site-wide in #92: rules only apply if the
  // Phosphor stylesheet actually reached the page, so a real computed
  // font-family (not a fallback) is the signal that matters.
  phosphorIcon: () => {
    const el = document.querySelector('[class*="ph-"]');
    if (!el) return { pass: false, detail: "no [class*=ph-] element found" };
    const family = getComputedStyle(el, "::before").fontFamily || "";
    const rect = el.getBoundingClientRect();
    const pass =
      /phosphor/i.test(family) && rect.width > 0 && rect.height > 0;
    return {
      pass,
      detail: `font-family="${family}" rect=${Math.round(rect.width)}x${Math.round(rect.height)}`,
    };
  },
  // The SPA renders icons as @phosphor-icons/vue SVGs, not the CSS font.
  svgIcon: () => {
    const svgs = Array.from(document.querySelectorAll("svg"));
    const rendered = svgs.find((s) => {
      const r = s.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && s.querySelector("path");
    });
    return {
      pass: !!rendered,
      detail: rendered
        ? "svg icon rendered"
        : `${svgs.length} svg found, none rendered with a path`,
    };
  },
};

const pageSpecs = [
  {
    path: "/",
    label: "landing",
    readySelector: "header nav",
    checks: ["headerNav", "phosphorIcon"],
  },
  {
    path: "/tools/resume-job-match",
    label: "tool",
    readySelector: "#resume-text",
    checks: ["headerNav", "toolForm", "phosphorIcon"],
  },
  {
    path: "/app/",
    label: "app-signin",
    readySelector: "#signin-email",
    checks: ["signInForm", "svgIcon"],
  },
  {
    path: "/save",
    label: "save-no-payload",
    // Not "h1": the loading state's h1 ("Saving this job...") also matches,
    // so waiting on it resolves before Vue flips to the no-payload error.
    readySelector: '[role="alert"]',
    checks: ["saveEmptyState"],
  },
  {
    path: "/blog",
    label: "blog",
    readySelector: "header nav",
    checks: ["headerNav", "phosphorIcon"],
  },
];

// Puppeteer's per-call `timeout` options (goto, waitForSelector, ...) race
// against the browser's *response*, but a wedged CDP connection can leave the
// call never settling at all (seen live: example.com hung the whole process
// past its 150s test-run ceiling with the launch-level `protocolTimeout` as
// the only fallback, itself a 180s default). Give every page pass its own
// hard wall-clock ceiling so one bad page can never stall the pool.
function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`hard timeout after ${ms}ms: ${label}`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function runPagePass(browser, spec, viewport) {
  const name = `${spec.path} @ ${viewport.label}px`;
  if (overBudget()) {
    record("page", name, false, "skipped: time budget exceeded");
    return;
  }

  const page = await browser.newPage();
  page.setDefaultTimeout(12_000);
  page.setDefaultNavigationTimeout(15_000);
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(err.message || String(err)));

  try {
    await page.setViewport({ width: viewport.width, height: viewport.height });
    await page.goto(BASE_URL + spec.path, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    try {
      await page.waitForSelector(spec.readySelector, { timeout: 10_000 });
    } catch {
      // Fall through: the selector checks below will report exactly what's
      // missing rather than failing this whole page pass opaquely.
    }

    for (const key of spec.checks) {
      const out = await page.evaluate(assertions[key]);
      record("selector", `${name} :: ${key}`, out.pass, out.detail);
    }

    record(
      "console",
      name,
      consoleErrors.length === 0 && pageErrors.length === 0,
      [...pageErrors, ...consoleErrors].slice(0, 3).join(" | ") || "clean",
    );

    const shotPath = path.join(
      screenshotsDir,
      `${spec.label}-${viewport.label}.png`,
    );
    await page.screenshot({ path: shotPath });
  } catch (err) {
    record("page", name, false, err.message || String(err));
  } finally {
    await page.close().catch(() => {});
  }
}

async function runPool(tasks, limit) {
  const queue = [...tasks];
  const workers = Array.from({ length: limit }, async () => {
    while (queue.length) {
      const task = queue.shift();
      if (!task) return;
      const { name, run } = task;
      try {
        await withTimeout(run(), 20_000, name);
      } catch (err) {
        record("page", name, false, err.message || String(err));
      }
    }
  });
  await Promise.all(workers);
}

// Last-resort circuit breaker: if anything above wedges despite its own
// timeouts, force the process to exit rather than hang forever (this is what
// caught the example.com hang during development).
const watchdog = setTimeout(() => {
  console.error(`FATAL: hard time budget (${TIME_BUDGET_MS}ms) exceeded, forcing exit`);
  process.exit(1);
}, TIME_BUDGET_MS + 20_000);

let browser;
try {
  browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    protocolTimeout: 15_000,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const tasks = [];
  for (const spec of pageSpecs) {
    for (const viewport of viewports) {
      tasks.push({
        name: `${spec.path} @ ${viewport.label}px`,
        run: () => runPagePass(browser, spec, viewport),
      });
    }
  }
  await runPool(tasks, 5);
} finally {
  if (browser) {
    await withTimeout(browser.close(), 5_000, "browser.close()").catch(() => {
      browser.process()?.kill("SIGKILL");
    });
  }
}

clearTimeout(watchdog);

// ---------------------------------------------------------------------------
// 3. Summary
// ---------------------------------------------------------------------------

const failed = results.filter((r) => !r.pass);
const summaryLines = [
  `# OpenApply prod smoke test`,
  ``,
  `- Base URL: ${BASE_URL}`,
  `- Ran: ${new Date().toISOString()}`,
  `- Duration: ${(elapsed() / 1000).toFixed(1)}s`,
  `- Checks: ${results.length} total, ${results.length - failed.length} passed, ${failed.length} failed`,
  ``,
  failed.length === 0 ? `## Result: PASS` : `## Result: FAIL`,
  ``,
];

if (failed.length > 0) {
  summaryLines.push(`## Failures`, ``);
  for (const f of failed) {
    summaryLines.push(`- **${f.category}: ${f.name}** — ${f.detail}`);
  }
  summaryLines.push(``);
}

summaryLines.push(`## All checks`, ``);
summaryLines.push(`| Category | Check | Result | Detail |`);
summaryLines.push(`| --- | --- | --- | --- |`);
for (const r of results) {
  summaryLines.push(
    `| ${r.category} | ${r.name} | ${r.pass ? "PASS" : "FAIL"} | ${r.detail.replace(/\|/g, "/")} |`,
  );
}

await fs.writeFile(path.join(OUT_DIR, "summary.md"), summaryLines.join("\n") + "\n");
await fs.writeFile(
  path.join(OUT_DIR, "results.json"),
  JSON.stringify({ baseUrl: BASE_URL, ranAt: new Date().toISOString(), durationMs: elapsed(), results }, null, 2),
);

console.log("");
console.log(summaryLines.slice(0, 8).join("\n"));
console.log(`Full report: ${path.join(OUT_DIR, "summary.md")}`);

process.exit(failed.length === 0 ? 0 : 1);
