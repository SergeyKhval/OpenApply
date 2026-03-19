# Programmatic SEO Pages for OpenApply

**Date:** 2026-03-19
**Status:** Approved

## Problem

OpenApply has near-zero organic search discovery. Over 90 days, Google Search Console shows 20 clicks from 1,336 impressions — almost all branded queries for a different company (openapply.com, an admissions platform). The blog (11 posts) has 0 clicks from search. The site needs a scalable way to attract job seekers searching for cover letter and resume help.

## Solution

Generate programmatic SEO pages at scale — 4 pages/day (2 cover letters + 2 resumes) targeting long-tail keywords like "cover letter for software engineer" and "resume guide for data analyst." Pages are generated via Gemini AI with Google Autocomplete keyword research, published to the Astro landing site, and deployed automatically.

## URL Structure

```
/cover-letters/{slug}   → e.g., /cover-letters/software-engineer
/resumes/{slug}          → e.g., /resumes/software-engineer
```

Astro file paths:
```
astro/src/pages/cover-letters/{slug}.md
astro/src/pages/resumes/{slug}.md
```

Each directory gets an `index.astro` listing page.

### Frontmatter Schema

Cover letter pages:
```yaml
---
layout: ../../layouts/CoverLetterExample.astro
title: 'Cover Letter for Software Engineers'
pubDate: 2026-03-19
description: 'AI-generated cover letter example for software engineer positions with prompt breakdown and role-specific tips.'
author: 'OpenApply Team'
role: 'Software Engineer'
slug: 'software-engineer'
relatedResume: '/resumes/software-engineer'
tags: ["Cover Letter", "Software Engineer", "Job Search"]
---
```

Resume pages:
```yaml
---
layout: ../../layouts/ResumeGuide.astro
title: 'Resume Guide for Software Engineers'
pubDate: 2026-03-19
description: 'Key skills, ATS keywords, and resume tips for software engineer positions.'
author: 'OpenApply Team'
role: 'Software Engineer'
slug: 'software-engineer'
relatedCoverLetter: '/cover-letters/software-engineer'
tags: ["Resume", "Software Engineer", "Job Search"]
---
```

## Page Templates

### Cover Letter Page

1. **H1**: "Cover Letter for [Role]"
2. **Sample cover letter** — AI-generated, realistic, tailored to the specific role with industry-appropriate language and examples
3. **"The Prompt Behind This Cover Letter"** — simplified version of the actual prompt template used in the app. Explains why each section matters (role context, company research, tone). This section is based on a key insight: a viral Reddit post (200k+ views) revealed that job seekers value prompt transparency over black-box AI outputs.
4. **"Why This Works"** — 3-4 bullets explaining what makes this cover letter effective for this specific role
5. **Role-specific advice** — Gemini selects the most relevant angle from a bank of real pain points: job hopping due to layoffs, career transitions, industry-specific norms, framing gaps, startup-to-enterprise moves, etc. Content varies per page — not every page includes this section.
6. **CTA** — "Generate your own personalized cover letter" → links to app signup with UTM parameters

### Resume Page

1. **H1**: "Resume Guide for [Role]"
2. **Key skills** — technical and soft skills that recruiters and hiring managers look for in this role
3. **ATS keywords** — specific terms to include on a resume for this role, sourced from Google Autocomplete research
4. **Role-specific advice** — same approach as cover letter pages: Gemini picks the most relevant angle per role (e.g., "transitioning from travel nursing" for nurses, "multiple startup stints" for engineers). Varies per page.
5. **Actionable resume tips** — 3-4 tips specific to the role, not generic advice
6. **CTA** — "Check how your resume matches this role" → links to app signup with UTM parameters

### Internal Linking

- Each cover letter page links to its matching resume page and vice versa
- Index pages at `/cover-letters/` and `/resumes/` list all published pages
- Cross-links help Google discover related pages and build topical authority

## Keyword Research Step

Before generating each page, the script queries Google Autocomplete API:
- `[job title] cover letter` → returns 10-20 related suggestions
- `[job title] resume` → returns 10-20 related suggestions

These suggestions are fed into the Gemini prompt as target keywords to incorporate naturally into the content. This ensures pages target queries people actually search for, not assumed keywords.

**Note:** "Google Autocomplete API" refers to the unofficial suggest endpoint (`suggestqueries.google.com/complete/search`). No API key required — it's a public GET request returning JSON.

## Job Titles Source

A curated `job-titles.json` file with ~130 entries covering the most common and searched-for roles. Each entry:

```json
{
  "slug": "software-engineer",
  "title": "Software Engineer",
  "category": "tech"
}
```

Titles are processed sequentially — 2 titles per day, both page types generated per title (4 pages total). At 2 titles/day, the initial list covers ~65 days.

## Generation Pipeline

New script `seo-automation.ts` in `openapply-blog-automation/` (sibling repo — both repos are expected as sibling directories, and the GitHub Action clones both):

1. Load `job-titles.json`
2. Scan target directories in `../openapply/astro/src/pages/` to find titles already published
3. Pick the next 2 unpublished titles (sequential order)
4. For each title:
   a. Query Google Autocomplete for related keywords
   b. Generate cover letter page via Gemini (with keywords and pain points bank in the prompt)
   c. Generate resume page via Gemini (with keywords and pain points bank in the prompt)
   d. Write `.md` files with Astro frontmatter
5. Git add, commit, and push all 4 pages in a single commit to the openapply repo

### Gemini Prompt Context

The generation prompt includes:
- The job title and category
- Autocomplete-derived keywords to incorporate
- A bank of real pain points drawn from user research (Reddit viral post with 200k+ views, 130 comments): job hopping anxiety from layoffs/RTO mandates, career transitions, startup chaos, international job search differences, "open to work" badge debate, ghosting and long wait times
- Instructions to select the most relevant pain point for this specific role (or skip if none fits naturally)
- For cover letter pages: instructions to include a prompt transparency section showing a simplified version of the generation prompt

## Changes to Existing Infrastructure

### blog-automation.ts
- Remove `sendEmailBroadcast()` function and all Resend-related code
- Remove `resend` from package.json dependencies
- Remove `RESEND_API_KEY` environment variable requirement
- Blog post generation continues unchanged (topic selection, Gemini generation, git commit/push)

### GitHub Actions CI
- Current: `blog-automation.yml` runs Mon/Thu
- Add new: `seo-automation.yml` runs daily
- Blog automation schedule unchanged
- SEO automation includes random delay (same pattern as blog) to avoid predictable publishing times

### Environment
- `GEMINI_API_KEY` — already configured, reused
- `OPENAPPLY_PAT` — already configured, reused
- No new secrets required (Resend key removed)

## Astro Site Changes

### New Layouts
- `CoverLetterExample.astro` — layout for cover letter pages (similar to BlogPost.astro but with different structure/styling)
- `ResumeGuide.astro` — layout for resume pages

### New Index Pages
- `astro/src/pages/cover-letters/index.astro` — lists all published cover letter pages
- `astro/src/pages/resumes/index.astro` — lists all published resume pages

### Sitemap
Astro's built-in sitemap generation handles new pages automatically. Submit updated sitemap to Google Search Console after first batch.

## Scale Plan

- **Phase 1** (days 1-65): Cover ~130 job titles with both page types (~260 pages)
- **Phase 2**: Expand job titles list. Future backlog item (openapply-c83) to auto-discover titles via Google Autocomplete.
- **Future**: Google Ads Keyword Planner API integration (openapply-ot7) for volume-based prioritization.

## Success Metrics

Track via Google Search Console and PostHog:
- Impressions for `/cover-letters/` and `/resumes/` pages (expect growth starting month 2-3)
- Clicks from non-branded search queries
- Click-through from SEO pages to app signup (UTM tracking)
- Number of indexed pages (GSC coverage report)

## Out of Scope

- Paid advertising or social media distribution
- Changes to the SPA or Cloud Functions
- Resume or cover letter feature changes in the app itself
- Blog content strategy changes (beyond killing email)
