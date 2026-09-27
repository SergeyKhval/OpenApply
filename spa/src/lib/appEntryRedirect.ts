// Brand-new visitors who type /app/ directly land on the sign-in screen with
// no context. Behind the app-entry-redirect flag, send them once to the
// landing page instead. Anyone with a referrer, a query string, a session, or
// a previous visit (to /app/ or the landing) is left alone.

import { ACQUISITION_STORAGE_KEY } from "../../../shared/acquisition";

export const APP_ENTRY_FLAG = "app-entry-redirect";
export const APP_ENTRY_MARKER_KEY = "openapply_app_entry_seen";
// Flags usually arrive well within this; after it the visitor may be typing
export const FLAG_WAIT_MS = 2000;

type EntryStorage = Pick<Storage, "getItem" | "setItem">;

export type AppEntry = {
  // Already seen here before: our marker or a first-touch record from any page
  returning: boolean;
  path: string;
  search: string;
  referrer: string;
};

// Must run before captureFirstTouchInBrowser, which writes the first-touch key
export function recordAppEntry(
  storage: EntryStorage | undefined,
  location: Pick<Location, "pathname" | "search">,
  referrer: string,
): AppEntry {
  let returning = true;
  try {
    if (storage) {
      returning =
        storage.getItem(APP_ENTRY_MARKER_KEY) !== null || storage.getItem(ACQUISITION_STORAGE_KEY) !== null;
      storage.setItem(APP_ENTRY_MARKER_KEY, "1");
    }
  } catch {
    // Blocked storage means no marker, so we can't promise "at most once": skip
    returning = true;
  }
  return { returning, path: location.pathname, search: location.search, referrer };
}

function isSignInRoute(path: string, base: string): boolean {
  const trimmed = base.replace(/\/+$/, "");
  return path === trimmed || path === `${trimmed}/`;
}

export function isBrandNewDirectEntry(entry: AppEntry, base: string): boolean {
  return !entry.returning && entry.referrer === "" && entry.search === "" && isSignInRoute(entry.path, base);
}

export type RedirectDeps = {
  base: string;
  // Resolves once auth has restored any saved session
  hasSession: () => Promise<boolean>;
  isFlagEnabled: () => Promise<boolean>;
  currentPath: () => string;
  redirect: (url: string) => void;
};

export async function redirectBrandNewEntrant(entry: AppEntry, deps: RedirectDeps): Promise<boolean> {
  if (!isBrandNewDirectEntry(entry, deps.base)) return false;
  if (await deps.hasSession()) return false;
  if (!(await deps.isFlagEnabled())) return false;
  // Re-check: they may have signed in or moved on while flags loaded
  if (!isSignInRoute(deps.currentPath(), deps.base) || (await deps.hasSession())) return false;
  deps.redirect("/");
  return true;
}
