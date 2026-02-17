# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenApply is an open-source, AI-powered job search assistant. It's a pnpm monorepo with three workspaces:

- **`spa/`** — Vue 3 SPA (main application, served at `/app/`)
- **`astro/`** — Astro landing page (marketing site, served at `/`)
- **`functions/`** — Firebase Cloud Functions (AI features, Stripe, email)

## Development Commands

### SPA (primary development target)
```bash
cd spa && pnpm dev          # Dev server at localhost:5173/app/
cd spa && pnpm type-check   # TypeScript checking (vue-tsc --noEmit)
cd spa && pnpm build        # Type-check + production build
```

### Firebase Functions
```bash
cd functions && pnpm build        # Compile TypeScript (tsc → lib/)
cd functions && pnpm lint         # ESLint
cd functions && pnpm build:watch  # Watch mode
```

### Astro Landing
```bash
cd astro && pnpm dev    # Dev server at localhost:4321
cd astro && pnpm build  # Production build
```

### Root-level
```bash
pnpm build              # Build all three workspaces
pnpm build:vercel       # Build + bundle SPA and Astro for Vercel deployment
pnpm emulate            # Start Firebase emulators (with import/export)
pnpm deploy:functions   # Deploy Cloud Functions
```

### Firebase Emulators
```bash
firebase emulators:start --import=./emulator-data --export-on-exit
```
Ports: Auth 9099, Functions 5001, Firestore 8080, Storage 9199, UI 4000.
The SPA auto-connects to emulators in dev mode unless `VITE_USE_PRODUCTION_FIREBASE=true`.

## Architecture

### SPA Tech Stack
- **Vue 3.5** with Composition API (`<script setup>`) and TypeScript 5.9 (strict)
- **Vite 7** with file-based routing via `unplugin-vue-router` (routes auto-generated from `spa/src/pages/`)
- **Tailwind CSS v4** (installed as Vite plugin via `@tailwindcss/vite`, NOT PostCSS)
- **Reka UI v2.5** + shadcn-pattern components in `spa/src/components/ui/`
- **Pinia v3** for state, **VueFire v3.2** for reactive Firebase bindings
- **@vuelidate/core** for form validation
- **@phosphor-icons/vue** for icons (NOT lucide-vue-next)
- **class-variance-authority (CVA)** + **tailwind-merge** for UI component variants
- Path alias: `@/` → `spa/src/`

### Cloud Functions Tech Stack
- Node.js 22 runtime, Firebase Functions v6
- **Google Genkit** with Gemini for AI (cover letters, job parsing, resume matching)
- Stripe for payments, Puppeteer/Chromium for web scraping, Cheerio for HTML parsing, pdf-parse for resumes, Resend for email

### Key Patterns

**File-based routing**: Pages in `spa/src/pages/` auto-generate routes. Dynamic routes use bracket notation (`[applicationId].vue`). Route types are generated in `spa/src/typed-router.d.ts`. Base path is `/app/`.

**Firebase integration**: Services initialized in `spa/src/firebase/config.ts` and exported as `auth`, `db`, `storage`, `functions`. Emulator connection is automatic in dev mode.

**Auth flow**: Router navigation guards in `spa/src/router/index.ts` wait for initial auth state before resolving protected routes. Admin routes check against `VITE_ADMIN_EMAIL`.

**Composables**: Business logic lives in `spa/src/composables/` (e.g., `useJobApplications`, `useCoverLetters`, `useResumes`). These wrap Firebase queries with VueFire reactive bindings.

**Firestore collections**: `jobApplications`, `jobApplicationNotes`, `contacts`, `interviews`, `userResumes`, `coverLetters`, `resumeJobMatches`, `jobs`, `users`, `promptTemplates`. All user data is scoped by `userId` field with ownership-based security rules.

**Credit system**: AI features consume credits. Stripe checkout via `createStripeCheckoutSession` function, webhook handling in `stripeWebhook`. Credit packs defined in `spa/src/constants/creditPacks.ts` and `functions/src/constants/creditPacks.ts`.

### Domain Types
Core types in `spa/src/types/index.ts`: `JobApplication` (with `JobStatus`: draft, applied, interviewing, offered, hired, rejected, archived), `Contact`, `Interview`, `Resume`, `CoverLetter`, `ResumeJobMatch`, `JobApplicationNote`. Status transitions are tracked with `CalendarDate` from `@internationalized/date`.

## Code Style

- Use TypeScript types over interfaces
- Use object destructuring for default props (not `withDefaults`)
- Use `<script setup>` for all Vue components
- Use `@phosphor-icons/vue` for icons
- Style with Tailwind CSS v4 classes
- Define emits with function signature syntax: `{ (event: "name", payload: Type): void }`
- Follow existing shadcn component patterns in `spa/src/components/ui/`
- Commit messages: `type: description` (e.g., `fix: resolve status not updating`)

## Environment Setup

- Node.js 22.20.0 (managed with asdf via `.tool-versions`)
- pnpm 10.18.2
- Java (oracle-25, required for Firebase emulators)
- Copy `.env.example` files in `spa/`, `astro/`, and `functions/` to configure

## Deployment

- **Vercel**: Hosts combined SPA + landing page. SPA at `/app/`, landing at `/`. PostHog reverse proxy at `/relay-VLVw/`.
- **Firebase**: Functions deployed separately via `pnpm deploy:functions`. Predeploy runs lint + build.
