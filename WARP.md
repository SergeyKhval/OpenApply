# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

OpenApply is a Vue 3 application for managing job applications, built with Vite and using Firebase for backend services (Authentication, Firestore, Storage).

## Development Commands

### Core Commands
- `pnpm dev` - Start development server on localhost:5173
- `pnpm build` - Type-check and build for production
- `pnpm preview` - Preview production build locally
- `pnpm type-check` - Run TypeScript type checking without emitting files

### Linting
- ESLint configuration using `eslint-plugin-vue` flat config
- Configured in `eslint.config.js` with recommended Vue rules

### Package Management
- This project uses **pnpm** as the package manager (v10.16.1)
- Node.js versions are managed with **asdf**, scoped to this project
- Install dependencies: `pnpm install`

## Architecture Overview

### Tech Stack
- **Frontend Framework**: Vue 3 with Composition API (`<script setup>`)
- **Build Tool**: Vite with plugins for Vue, Tailwind CSS v4, and file-based routing
- **Styling**: Tailwind CSS v4 (installed as Vite plugin, no PostCSS)
- **UI Components**: Reka UI + custom components following shadcn pattern
- **Type Safety**: TypeScript with strict mode
- **Routing**: File-based routing via `unplugin-vue-router`
- **State Management**: VueFire for Firebase integration
- **Backend**: Firebase (Auth, Firestore, Storage)

### Project Structure

```
src/
├── pages/              # File-based routing pages
│   ├── index.vue       # Landing page
│   └── dashboard/      # Protected dashboard routes
│       ├── applications/
│       │   ├── index.vue
│       │   └── [applicationId].vue  # Dynamic route
│       ├── resumes.vue
│       └── archive.vue
├── components/         # Vue components
│   ├── ui/            # Reusable UI components (shadcn pattern)
│   │   ├── badge/     # Badge component
│   │   ├── button/    # Button component
│   │   ├── calendar/  # Calendar components
│   │   ├── card/      # Card components
│   │   ├── dialog/    # Dialog/Modal components
│   │   ├── input/     # Input component
│   │   ├── label/     # Label component
│   │   ├── popover/   # Popover components
│   │   └── select/    # Select dropdown components
│   └── *.vue          # Feature-specific components
├── composables/       # Vue composables
│   ├── useAuth.ts     # Authentication logic
│   ├── useJobApplications.ts
│   └── useResumes.ts  # Resume management
├── firebase/          # Firebase configuration
│   ├── config.ts      # Firebase initialization
│   └── restoreJobApplication.ts
├── types/             # TypeScript type definitions
│   └── index.ts       # Core application types
├── router/            # Vue Router setup
├── lib/               # Utility functions
│   └── utils.ts       # General utilities
└── constants/         # Application constants
    └── symbols.ts     # Provide/inject symbols

functions/             # Firebase Cloud Functions (separate workspace)
├── src/
│   └── index.ts      # Cloud function definitions
├── package.json      # Node 22, firebase-admin, pdf-parse
└── tsconfig.json
```

### Key Architectural Patterns

1. **File-based Routing**: Routes are auto-generated from the `src/pages/` directory structure. Dynamic routes use bracket notation (e.g., `[applicationId].vue`).

2. **Firebase Integration**: The app uses VueFire for reactive Firebase bindings. Firebase services (auth, firestore, storage) are initialized in `src/firebase/config.ts` and integrated via the VueFire plugin in `main.ts`.

3. **Type Safety**: 
   - Strict TypeScript configuration
   - Auto-generated route types in `typed-router.d.ts`
   - Core domain types defined in `src/types/index.ts`

4. **Component Architecture**:
   - Feature components handle business logic (e.g., `AddJobApplication.vue`, `JobApplicationCard.vue`)
   - UI components in `src/components/ui/` are reusable, styled components
   - Composables encapsulate reusable logic with Firebase integration

5. **Authentication Flow**: Managed through VueFireAuth module, with authentication state handled by the `useAuth` composable.

## Environment Configuration

The app requires Firebase configuration via environment variables in `.env.local`:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

### Version Management
- Node.js version: 24.9.0 (managed with asdf via `.tool-versions`)
- Package manager: pnpm 10.16.1

## Code Style Preferences

- Use object destructuring for default props instead of `withDefaults` macro
- Prefer TypeScript Types over Interfaces
- Avoid redundant comments when code is self-explanatory
- Path aliases: `@/` maps to `src/` directory
- Use Tailwind CSS classes for styling
- Define Vue emit types using function signature syntax:
  ```typescript
  type ComponentEmits = {
    (event: "eventName", payload: PayloadType): void;
    (event: "anotherEvent"): void;
  };
  ```

## Domain Model

The application manages job applications with the following core types:
- `JobApplication`: Main entity with status tracking (applied, interviewing, offered, hired, archived)
- `JobApplicationNote`: Notes attached to applications
- `Contact`: People associated with applications
- `Interview`: Interview scheduling and tracking

Status transitions are time-tracked with Firebase Timestamps or CalendarDate objects from `@internationalized/date`.

## Deployment

The application supports multiple deployment targets:

### Firebase Hosting
- Configuration in `firebase.json`
- Build output served from `dist/` directory
- SPA rewrites configured for client-side routing
- Includes Firebase Functions deployment

### Vercel
- Configuration in `vercel.json`
- SPA rewrites configured for Vue Router

### Firebase Functions
- Separate workspace in `functions/` directory
- Node.js 22 runtime
- Dependencies: firebase-admin, pdf-parse
- Build command: `pnpm --prefix functions build`
- Lint command: `pnpm --prefix functions lint`

## UI Components Library

The project uses a custom implementation of shadcn-like components built on top of Reka UI:
- Components follow the shadcn pattern with compound component architecture
- Located in `src/components/ui/` directory
- Styled with Tailwind CSS v4 and class-variance-authority (CVA)
- Includes: Badge, Button, Calendar, Card, Dialog, Input, Label, Popover, Select
- Each component has its own directory with index.ts barrel export
