import type { RouteRecordRaw } from "vue-router";

// Old /dashboard/... urls (bookmarks, open tabs, weekly digest emails already
// sent) land on the same place in the Jobs / Documents / Settings layout.
// Query strings are kept.
export const legacyRedirects: RouteRecordRaw[] = [
  { path: "/dashboard", redirect: (to) => ({ path: "/jobs", query: to.query }) },
  {
    path: "/dashboard/applications",
    redirect: (to) => ({ path: "/jobs", query: to.query }),
  },
  {
    path: "/dashboard/applications/new",
    redirect: (to) => ({ path: "/jobs/new", query: to.query }),
  },
  {
    path: "/dashboard/applications/:applicationId",
    redirect: (to) => ({
      // Legacy route, so it's not in the typed route map
      path: `/jobs/${String((to.params as Record<string, string>).applicationId)}`,
      query: to.query,
    }),
  },
  {
    path: "/dashboard/archive",
    redirect: (to) => ({ path: "/jobs", query: { ...to.query, stage: "closed" } }),
  },
  {
    path: "/dashboard/resumes",
    redirect: (to) => ({ path: "/documents", query: { ...to.query, tab: "resumes" } }),
  },
  {
    path: "/dashboard/cover-letters",
    redirect: (to) => ({
      path: "/documents",
      query: { ...to.query, tab: "cover-letters" },
    }),
  },
  {
    path: "/dashboard/file-import",
    redirect: (to) => ({ path: "/settings/import-export", query: to.query }),
  },
];
