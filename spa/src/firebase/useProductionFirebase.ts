// Vite env vars are always strings, so VITE_USE_PRODUCTION_FIREBASE="false" must
// be compared explicitly rather than treated as truthy.
export const useProductionFirebase = (env: { VITE_USE_PRODUCTION_FIREBASE?: string }): boolean =>
  env.VITE_USE_PRODUCTION_FIREBASE === "true";
