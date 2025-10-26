# Product Requirements Document (PRD): Landing page changes for open-sourcing

## 1. Objective
- Announce open-source availability, add clear GitHub/Discord entry points, and introduce a simple self-hosting option in Pricing without adding new sections or visuals.

## 2. Scope
- Affects: Astro landing page only.
- Excludes: Vue SPA, backend, SEO/legal/privacy changes, new sections/visuals.

## 3. Requirements

### 3.1 Header (sticky on load)
- Sticky header visible immediately on page load (desktop and mobile).
- Navigation items (anchors): How it Works (#how-it-works), Features (#features), Pricing (#pricing), FAQ (#faq).
- External links (right side): GitHub (https://github.com/SergeyKhval/OpenApply), Discord (https://discord.gg/VSPCrpbbZb).
- Mobile: Hamburger menu with the same anchors and external links.
- Accessibility: Focus states, aria-labels for external icons.

### 3.2 Hero
- Primary CTA only: “Get Started Free” → /app.
- Add a minimal monochrome GitHub icon (no star count) linking to repo; include accessible label “View on GitHub”.
- No additional hero copy/sections/visuals.

### 3.3 Pricing
- Add a third card: “Self‑Host (Free)”.
- Copy:
  - Title: Self‑Host (Free)
  - Bullets:
    - Run locally or on your own infra
    - All core features included
    - Bring your own API keys
    - Setup guide in README
  - Button: “View on GitHub” → https://github.com/SergeyKhval/OpenApply
- Keep existing cards unchanged.

### 3.4 Anchors/IDs
- Section IDs: #how-it-works, #features, #pricing, #faq.
- No “Hero” link in navigation.

### 3.5 Copy (final)
- Header labels: How it Works, Features, Pricing, FAQ, GitHub, Discord.
- Hero CTA: Get Started Free.
- Self‑Host card: as specified above.
- No mention of support or SLAs.

## 4. Non-Requirements
- No new sections (e.g., “Open Source” block), diagrams, badges with counts, SEO/meta updates, legal/privacy notices, or footer changes.

## 5. Acceptance Criteria
- Sticky header appears on load; desktop/mobile parity with specified nav items and GitHub/Discord links.
- Hero shows only “Get Started Free” plus a GitHub icon link (no star count).
- Pricing includes the “Self‑Host (Free)” card with specified copy and a GitHub button.
- Anchors scroll to correct sections with no layout shifts.
- All external links open in a new tab and have appropriate rel attributes.

## 6. Rollout Plan (launch Monday)
- Prep (by Friday EOD):
  - Implement header, hero GitHub icon, and pricing card.
  - Verify anchors, responsive/mobile menu, and accessibility states.
  - Confirm README includes self-host/BYO API keys setup instructions.
- Launch (Monday):
  - Option A (Lean): Deploy; announce on LinkedIn and Twitter; use homepage as canonical link.
  - Option B (Badge): Same as A, plus small “Now open‑source” text near the GitHub icon (no additional section).
- Post-launch:
  - Optional Product Hunt post reusing the same homepage; no additional homepage edits required.

## 7. Risks/Dependencies
- Consistency of repo link across header, hero, and Pricing.
- Mobile navigation usability and focus/keyboard accessibility.
- README must adequately cover local/self-host setup (BYO API keys).
