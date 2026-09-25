import { PhBriefcase, PhFiles, PhUserCircle } from "@phosphor-icons/vue";

export const MAIN_NAV = [
  { to: "/jobs", label: "Jobs", icon: PhBriefcase },
  { to: "/documents", label: "Documents", icon: PhFiles },
];

// Phones: the same two plus "Me" (settings and account)
export const TAB_NAV = [...MAIN_NAV, { to: "/settings", label: "Me", icon: PhUserCircle }];

// A section stays highlighted on its sub-pages (/jobs/abc, /settings/email)
export const isNavActive = (path: string, to: string) => path === to || path.startsWith(`${to}/`);
