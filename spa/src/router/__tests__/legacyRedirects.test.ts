import { describe, expect, it } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import { legacyRedirects } from "../legacyRedirects";

const Stub = { template: "<div />" };

const makeRouter = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", component: Stub },
      { path: "/jobs", component: Stub },
      { path: "/jobs/new", component: Stub },
      { path: "/jobs/:jobId", component: Stub },
      { path: "/documents", component: Stub },
      { path: "/settings/import-export", component: Stub },
      ...legacyRedirects,
    ],
  });

describe("legacy /dashboard urls", () => {
  it.each([
    ["/dashboard", "/jobs"],
    ["/dashboard/applications", "/jobs"],
    ["/dashboard/applications?utm_source=email", "/jobs?utm_source=email"],
    ["/dashboard/applications/new?job-link=x", "/jobs/new?job-link=x"],
    ["/dashboard/applications/abc123", "/jobs/abc123"],
    ["/dashboard/applications/abc123?created=1&from=tool", "/jobs/abc123?created=1&from=tool"],
    ["/dashboard/archive", "/jobs?stage=closed"],
    ["/dashboard/resumes", "/documents?tab=resumes"],
    ["/dashboard/cover-letters", "/documents?tab=cover-letters"],
    ["/dashboard/cover-letters?dialog-name=generate-cover-letter", "/documents?dialog-name=generate-cover-letter&tab=cover-letters"],
    ["/dashboard/file-import", "/settings/import-export"],
  ])("%s lands on %s", async (from, to) => {
    const router = makeRouter();
    await router.push(from);
    expect(router.currentRoute.value.fullPath).toBe(to);
  });
});

describe("old password auth urls", () => {
  it.each([
    ["/login", "/"],
    ["/sign-in?redirect=/jobs", "/?redirect=/jobs"],
    ["/forgot-password", "/"],
    ["/reset-password?oobCode=abc", "/?oobCode=abc"],
    ["/signup", "/?mode=signup"],
    ["/sign-up", "/?mode=signup"],
  ])("%s lands on %s", async (from, to) => {
    const router = makeRouter();
    await router.push(from);
    expect(router.currentRoute.value.fullPath).toBe(to);
  });
});
