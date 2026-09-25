/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BASE_URL: string;
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_USE_PRODUCTION_FIREBASE?: string;
  readonly VITE_PUBLIC_POSTHOG_API_KEY?: string;
  readonly VITE_PUBLIC_POSTHOG_HOST?: string;
  readonly VITE_ADMIN_EMAIL?: string;
  readonly VITE_SUPPORT_EMAIL?: string;
  // Chrome Web Store page of the extension; first run leads with it when set
  readonly VITE_EXTENSION_URL?: string;
  // PostHog flags forced on for this build, comma separated
  readonly VITE_FEATURE_FLAGS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
