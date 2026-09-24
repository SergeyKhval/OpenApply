// Light or dark theme. Follows the OS unless the person picked one; the choice
// is stored per browser under THEME_STORAGE_KEY (shared with the landing page,
// which reads it in its own pre-paint script).
export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "oa-theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

export const resolveTheme = (preference: ThemePreference, prefersDark: boolean) =>
  preference === "system" ? (prefersDark ? "dark" : "light") : preference;

export const readPreference = (
  storage: Storage | undefined = globalThis.localStorage,
): ThemePreference => {
  try {
    const stored = storage?.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
};

const systemPrefersDark = (mediaQuery?: MediaQueryList) =>
  (mediaQuery ?? globalThis.matchMedia?.(DARK_QUERY))?.matches ?? false;

export const applyTheme = (
  preference: ThemePreference,
  root: HTMLElement = document.documentElement,
  mediaQuery?: MediaQueryList,
) => {
  const theme = resolveTheme(preference, systemPrefersDark(mediaQuery));
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
};

export const setThemePreference = (preference: ThemePreference) => {
  try {
    if (preference === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage blocked (private mode): still apply it for this page view
  }
  applyTheme(preference);
};

// Re-apply when the OS switches between light and dark
export const watchSystemTheme = () => {
  const mediaQuery = globalThis.matchMedia?.(DARK_QUERY);
  if (!mediaQuery) return () => {};
  const onChange = () => applyTheme(readPreference(), document.documentElement, mediaQuery);
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
};
