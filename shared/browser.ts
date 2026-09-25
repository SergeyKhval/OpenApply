// Desktop Chrome, Edge and other Chromium browsers can install the OpenApply
// extension from the Chrome Web Store. Client hints first, then the UA string.
//
// The landing inlines this function's source into <head> (see
// astro/src/pages/index.astro) so the right hero shows before first paint.
// Keep it self-contained: no imports and no references to outer variables.
export type NavigatorLike = {
  userAgent: string;
  userAgentData?: { brands: { brand: string; version?: string }[]; mobile: boolean };
};

export function isDesktopChromium(nav?: NavigatorLike): boolean {
  if (!nav) return false;
  const extensionBrands = ["Google Chrome", "Microsoft Edge", "Chromium"];
  // Some browsers and emulators expose client hints with no brands
  if (nav.userAgentData && nav.userAgentData.brands.length) {
    return (
      !nav.userAgentData.mobile &&
      nav.userAgentData.brands.some((entry) => extensionBrands.includes(entry.brand))
    );
  }
  const ua = nav.userAgent;
  if (/Mobile|Android|iPhone|iPad|CriOS|OPR\/|SamsungBrowser|YaBrowser/.test(ua)) return false;
  return /Edg\//.test(ua) || /Chrome\/\d+/.test(ua);
}
