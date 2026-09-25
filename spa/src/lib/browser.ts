// Desktop Chrome, Edge and other Chromium browsers: they install the
// OpenApply extension from the Chrome Web Store.
// Client hints first (not faked by UA spoofing tools as often), then the UA.
type NavigatorLike = {
  userAgent: string;
  userAgentData?: { brands: { brand: string; version?: string }[]; mobile: boolean };
};

const EXTENSION_BRANDS = ["Google Chrome", "Microsoft Edge", "Chromium"];

export function isDesktopChromium(nav: NavigatorLike | undefined = globalThis.navigator) {
  if (!nav) return false;
  // Some browsers and emulators expose client hints with no brands
  if (nav.userAgentData?.brands.length) {
    return (
      !nav.userAgentData.mobile &&
      nav.userAgentData.brands.some(({ brand }) => EXTENSION_BRANDS.includes(brand))
    );
  }
  const ua = nav.userAgent;
  if (/Mobile|Android|iPhone|iPad|CriOS|OPR\/|SamsungBrowser|YaBrowser/.test(ua)) return false;
  return /Edg\//.test(ua) || /Chrome\/\d+/.test(ua);
}
