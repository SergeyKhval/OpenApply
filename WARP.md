# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

OpenApply is a modern job application tracking system with AI-powered features. The project consists of three main components:
- **SPA**: Vue 3 application for the main application interface (in `spa/` directory)
- **Landing Page**: Astro-based marketing website (in `astro/` directory)  
- **Cloud Functions**: Firebase Functions for backend AI features and integrations (in `functions/` directory)

## Development Commands

### Root-level Commands
- `pnpm build:spa` - Build the Vue SPA
- `pnpm build:astro` - Build the Astro landing page
- `pnpm build:functions` - Build Firebase Functions
- `pnpm build` - Build all components
- `pnpm build:vercel` - Build and bundle for Vercel deployment
- `pnpm emulate` - Start Firebase emulators
- `pnpm deploy:functions` - Deploy Firebase Functions

### SPA Commands (from `spa/` directory)
- `pnpm dev` - Start development server (default on localhost:5173 with base path `/app/`)
- `pnpm build` - Type-check and build for production
- `pnpm preview` - Preview production build locally
- `pnpm type-check` - Run TypeScript type checking without emitting files

### Package Management
- This project uses **pnpm** as the package manager (v10.18.2)
- Node.js version: 22.20.0 (managed with **asdf**, scoped to this project via `.tool-versions`)
- Install dependencies: `pnpm install` from root or workspace directories

## Architecture Overview

### Tech Stack

#### SPA (`spa/` directory)
- **Frontend Framework**: Vue 3.5 with Composition API (`<script setup>`)
- **Build Tool**: Vite 7 with plugins for Vue, Tailwind CSS v4, and file-based routing
- **Styling**: Tailwind CSS v4 (installed as Vite plugin via `@tailwindcss/vite`, no PostCSS)
- **Icons**: @phosphor-icons/vue (NOT lucide-vue-next)
- **UI Components**: Reka UI v2.5 + custom components following shadcn pattern
- **Type Safety**: TypeScript 5.9 with strict mode
- **Routing**: File-based routing via `unplugin-vue-router` with Vue Router 4.5
- **State Management**: 
  - Pinia v3 for application state
  - VueFire v3.2 for Firebase integration
- **Form Validation**: @vuelidate/core
- **Analytics**: PostHog integration
- **Backend Integration**: Firebase (Auth, Firestore, Storage)

#### Cloud Functions (`functions/` directory)
- **Runtime**: Node.js 22
- **Framework**: Firebase Functions v6
- **AI Integration**: Google Genkit with Gemini models
- **Payment Processing**: Stripe integration
- **Web Scraping**: Puppeteer with Chromium
- **PDF Processing**: pdf-parse
- **HTML Parsing**: Cheerio

### Project Structure

```
.
├── spa/                      # Vue 3 SPA application
│   ├── src/
│   │   ├── pages/           # File-based routing pages
│   │   │   ├── index.vue    # Landing/signin page
│   │   │   ├── dashboard.vue # Main dashboard layout
│   │   │   ├── admin.vue    # Admin page (requires admin access)
│   │   │   └── dashboard/   # Protected dashboard routes
│   │   │       ├── applications/
│   │   │       │   ├── index.vue
│   │   │       │   └── [applicationId].vue  # Dynamic route
│   │   │       ├── archive.vue
│   │   │       ├── cover-letters.vue
│   │   │       ├── file-import.vue
│   │   │       └── resumes.vue
│   │   ├── components/      # Vue components
│   │   │   ├── ui/         # Reusable UI components (shadcn pattern)
│   │   │   │   ├── alert/
│   │   │   │   ├── avatar/
│   │   │   │   ├── badge/
│   │   │   │   ├── button/
│   │   │   │   ├── calendar/
│   │   │   │   ├── card/
│   │   │   │   ├── dialog/
│   │   │   │   ├── dropdown-menu/
│   │   │   │   ├── empty/
│   │   │   │   ├── input/
│   │   │   │   ├── label/
│   │   │   │   ├── popover/
│   │   │   │   ├── select/
│   │   │   │   ├── separator/
│   │   │   │   ├── sheet/
│   │   │   │   └── skeleton/
│   │   │   └── *.vue       # Feature-specific components
│   │   ├── composables/    # Vue composables
│   │   │   ├── useAuth.ts
│   │   │   ├── useCoverLetters.ts      # Cover letter generation
│   │   │   ├── useCreditsCheckout.ts   # Stripe checkout
│   │   │   ├── useJobApplications.ts
│   │   │   ├── useJobApplicationsData.ts
│   │   │   ├── useJobIngestion.ts      # Job scraping/parsing
│   │   │   ├── usePostHog.ts           # Analytics
│   │   │   ├── useResumes.ts
│   │   │   └── useUpdateJobApplicationStatus.ts
│   │   ├── stores/         # Pinia stores
│   │   │   └── drawerNavigationStore.ts
│   │   ├── firebase/       # Firebase configuration
│   │   │   ├── config.ts
│   │   │   └── restoreJobApplication.ts
│   │   ├── router/         # Vue Router configuration
│   │   │   └── index.ts    # Router with auth guards
│   │   ├── types/
│   │   │   └── index.ts    # Core TypeScript types
│   │   ├── constants/
│   │   │   ├── creditPacks.ts  # Stripe pricing tiers
│   │   │   └── symbols.ts       # Provide/inject symbols
│   │   ├── lib/
│   │   │   └── utils.ts
│   │   ├── App.vue         # Root component
│   │   └── main.ts         # Application entry point
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── functions/              # Firebase Cloud Functions
│   ├── src/
│   │   ├── constants/
│   │   │   └── creditPacks.ts
│   │   ├── createStripeCheckoutSession.ts
│   │   ├── createUserProfile.ts
│   │   ├── generateCoverLetter.ts      # AI cover letter generation
│   │   ├── index.ts                     # Function exports
│   │   ├── jobApplications.ts
│   │   ├── jobs.ts
│   │   ├── migrateCoverLettersToJobApplications.ts
│   │   ├── parseJobPageWithAi.ts       # AI job parsing
│   │   ├── parseResume.ts              # Resume parsing
│   │   ├── scrapeJobLink.ts            # Web scraping
│   │   └── stripeWebhook.ts
│   ├── package.json
│   └── tsconfig.json
│
├── astro/                  # Astro landing page
│   ├── package.json
│   └── tsconfig.json
│
├── firebase.json           # Firebase configuration
├── firestore.rules        # Firestore security rules
├── firestore.indexes.json # Firestore indexes
├── storage.rules          # Storage security rules
├── vercel.json           # Vercel deployment config
└── package.json          # Root package.json with workspace scripts
```

### Key Architectural Patterns

1. **File-based Routing**: Routes are auto-generated from the `spa/src/pages/` directory structure. Dynamic routes use bracket notation (e.g., `[applicationId].vue`). The base path is configurable via `VITE_BASE_URL` (defaults to `/app/`).

2. **Firebase Integration**: 
   - VueFire v3.2 for reactive Firebase bindings
   - Firebase services (auth, firestore, storage) initialized in `spa/src/firebase/config.ts`
   - Cloud Functions for AI features and Stripe integration
   - Emulator support for local development

3. **Type Safety**: 
   - Strict TypeScript configuration
   - Auto-generated route types in `spa/src/typed-router.d.ts`
   - Core domain types defined in `spa/src/types/index.ts`
   - Shared types between functions and SPA

4. **Component Architecture**:
   - Feature components handle business logic (e.g., `AddJobApplication.vue`, `JobApplicationCard.vue`)
   - UI components in `spa/src/components/ui/` follow shadcn pattern with Reka UI
   - Composables encapsulate reusable logic with Firebase integration
   - Pinia stores for global state management

5. **Authentication & Authorization**: 
   - Firebase Authentication with auth guards in router
   - Admin-only routes protected via email check
   - User authentication state managed by `useAuth` composable
   - Auth persistence handled in router navigation guards

6. **AI Features**:
   - Cover letter generation using Google Genkit and Gemini
   - Resume parsing from PDFs
   - Job description scraping and parsing
   - Credit-based system with Stripe payment integration

7. **Payment Integration**:
   - Stripe checkout for purchasing AI credits
   - Webhook handling for payment confirmation  
   - Credit pack tiers defined in constants

## Environment Configuration

### SPA Environment Variables (in `spa/.env.local`)
- `VITE_BASE_URL` - Base URL path (defaults to `/app/`)
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_ADMIN_EMAIL` - Admin user email for protected routes
- `VITE_PUBLIC_POSTHOG_API_KEY` - PostHog analytics key (optional)
- `VITE_PUBLIC_POSTHOG_HOST` - PostHog host URL (optional)

### Version Management
- Node.js version: 22.20.0 (managed with asdf via `.tool-versions`)
- Package manager: pnpm 10.18.2
- Functions runtime: Node.js 22

## Code Style Preferences

- Use object destructuring for default props instead of `withDefaults` macro
- Prefer TypeScript Types over Interfaces
- Avoid redundant comments when code is self-explanatory
- Path aliases: `@/` maps to `spa/src/` directory
- Use Tailwind CSS v4 classes for styling
- Use @phosphor-icons/vue for icons (NOT lucide-vue-next)
- Define Vue emit types using function signature syntax:
  ```typescript
  type ComponentEmits = {
    (event: "eventName", payload: PayloadType): void;
    (event: "anotherEvent"): void;
  };
  ```
- Use Composition API with `<script setup>` syntax
- Follow shadcn component patterns for UI components

## Domain Model

The application manages job applications with the following core types:
- `JobApplication`: Main entity with status tracking (applied, interviewing, offered, hired, archived)
- `JobApplicationNote`: Notes attached to applications
- `Contact`: People associated with applications
- `Interview`: Interview scheduling and tracking
- `Resume`: User-uploaded resumes (PDF)
- `CoverLetter`: AI-generated cover letters linked to applications
- `UserProfile`: User account with credit balance for AI features

Status transitions are time-tracked with Firebase Timestamps or CalendarDate objects from `@internationalized/date`.

### AI Features
- **Cover Letter Generation**: Uses job description and resume to generate tailored cover letters
- **Job Parsing**: Scrapes and extracts structured data from job posting URLs
- **Resume Parsing**: Extracts text content from PDF resumes
- **Credit System**: Pay-per-use model for AI features with Stripe integration

## Deployment

The application supports multiple deployment targets:

### Firebase
- Configuration in `firebase.json`
- Firestore with location `nam5`
- Security rules in `firestore.rules` and `storage.rules`
- Cloud Functions deployment with predeploy hooks
- Emulator configuration for local development:
  - Auth: port 9099
  - Functions: port 5001
  - Firestore: port 8080
  - Storage: port 9199
  - Emulator UI: port 4000

### Vercel
- Configuration in `vercel.json`
- Build command: `pnpm run build:vercel`
- Bundles both Astro landing and Vue SPA
- SPA served from `/app/` path with client-side routing
- Landing page served from root `/`

### Firebase Functions
- Separate workspace in `functions/` directory
- Node.js 22 runtime
- Key dependencies: 
  - Google Genkit for AI
  - Stripe for payments
  - Puppeteer for web scraping
  - pdf-parse for resume parsing
- Build command: `pnpm --prefix functions build`
- Deploy command: `pnpm deploy:functions`

## UI Components Library

The project uses a custom implementation of shadcn-like components built on top of Reka UI v2.5:
- Components follow the shadcn pattern with compound component architecture
- Located in `spa/src/components/ui/` directory
- Styled with Tailwind CSS v4 and class-variance-authority (CVA)
- Component library includes:
  - **Layout**: Card, Sheet, Separator
  - **Forms**: Input, Label, Select, Button
  - **Display**: Badge, Avatar, Alert, Empty, Skeleton
  - **Overlays**: Dialog, Popover, Dropdown Menu
  - **Date/Time**: Calendar components
- Each component has its own directory with index.ts barrel export
- Uses tailwind-merge for className composition
- Icons from @phosphor-icons/vue library
