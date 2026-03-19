# Programmatic SEO Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate 4 SEO pages/day (2 cover letter examples + 2 resume guides) via automated pipeline, published to the Astro landing site.

**Architecture:** New `seo-automation.ts` script in `openapply-blog-automation/` repo queries Google Autocomplete for keywords, generates pages via Gemini, writes `.md` files to the `openapply` Astro site, and commits/pushes. Two new Astro layouts and index pages render the content. Email broadcasting is removed from the existing blog automation.

**Tech Stack:** TypeScript, Gemini 2.0 Flash (`@google/generative-ai`), Astro, GitHub Actions

**Spec:** `docs/superpowers/specs/2026-03-19-programmatic-seo-pages-design.md`

---

## File Structure

### openapply-blog-automation/ (automation repo)

| File | Responsibility |
|------|---------------|
| `seo-automation.ts` (create) | Main pipeline: load titles, autocomplete research, generate pages, git push |
| `job-titles.json` (create) | Curated list of ~130 job titles with slug, display name, category |
| `prompts/cover-letter-page.ts` (create) | Gemini prompt builder for cover letter pages |
| `prompts/resume-page.ts` (create) | Gemini prompt builder for resume pages |
| `lib/autocomplete.ts` (create) | Google Autocomplete keyword fetcher |
| `lib/gemini.ts` (create) | Shared Gemini client initialization |
| `lib/git.ts` (create) | Git commit/push helpers (extracted from blog-automation.ts) |
| `blog-automation.ts` (modify) | Remove Resend email code, extract shared git helpers |
| `package.json` (modify) | Remove `resend` dependency |
| `.github/workflows/seo-automation.yml` (create) | Daily cron for SEO page generation |
| `.github/workflows/blog-automation.yml` (modify) | Remove `RESEND_API_KEY` from env |

### openapply/ (Astro site repo)

| File | Responsibility |
|------|---------------|
| `astro/src/layouts/CoverLetterExample.astro` (create) | Layout for cover letter pages with SEO schema |
| `astro/src/layouts/ResumeGuide.astro` (create) | Layout for resume pages with SEO schema |
| `astro/src/pages/cover-letters.astro` (create) | Index listing page for all cover letter pages |
| `astro/src/pages/resumes.astro` (create) | Index listing page for all resume pages |
| `astro/src/pages/cover-letters/` (directory, auto-populated) | Generated `.md` cover letter pages |
| `astro/src/pages/resumes/` (directory, auto-populated) | Generated `.md` resume pages |

---

## Task 1: Remove Email from Blog Automation

**Repo:** `openapply-blog-automation/`

**Files:**
- Modify: `blog-automation.ts`
- Modify: `package.json`
- Modify: `.github/workflows/blog-automation.yml`

- [ ] **Step 1: Remove Resend imports and config from blog-automation.ts**

Remove these lines:
- Line 9: `const RESEND_API_KEY = ...`
- Line 10: `const AUDIENCE_ID = ...`
- Lines 18-21: The `RESEND_API_KEY` check (keep only `GEMINI_API_KEY` check)
- Lines 176-319: The entire `generateTeaser()`, `buildEmailHtml()`, and `sendBroadcast()` functions
- Lines 344-346: The email broadcast call in `main()` (`console.log("Step 3...")` and `await sendBroadcast(...)`)
- Update the "Step 2" log to say "Step 2" (it already is)

After removal, `main()` should be:
```typescript
async function main() {
  const topic = findNextTopic();
  if (!topic) {
    console.log("All topics have been generated. Nothing to do.");
    process.exit(0);
  }

  console.log(`\n=== Generating: ${topic.slug} ===\n`);

  console.log("Step 1: Generating blog post with Gemini...");
  const postContent = await generatePost(topic);
  const outPath = join(BLOG_DIR, `${topic.slug}.md`);
  writeFileSync(outPath, postContent, "utf-8");
  console.log(`Written: ${outPath}\n`);

  console.log("Step 2: Committing and pushing...");
  commitAndPush(topic);

  console.log(`\n=== Done: ${topic.slug} ===\n`);
}
```

- [ ] **Step 2: Remove resend from package.json**

Remove `"resend": "^4.0.0"` from dependencies.

- [ ] **Step 3: Remove RESEND_API_KEY from GitHub Actions workflow**

In `.github/workflows/blog-automation.yml`, remove the `RESEND_API_KEY` line from the env block:
```yaml
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
```

- [ ] **Step 4: Run npm install to update lockfile**

```bash
cd ../openapply-blog-automation && npm install
```

- [ ] **Step 5: Test blog automation still works**

```bash
cd ../openapply-blog-automation && GEMINI_API_KEY=test npx tsx -e "
import { readFileSync } from 'fs';
console.log('Script parses OK');
"
```

Verify the script compiles without errors (the Resend import should be gone).

- [ ] **Step 6: Commit**

```bash
cd ../openapply-blog-automation
git add blog-automation.ts package.json package-lock.json .github/workflows/blog-automation.yml
git commit -m "chore: remove email broadcasting from blog automation"
```

---

## Task 2: Create Shared Libraries

**Repo:** `openapply-blog-automation/`

**Files:**
- Create: `lib/autocomplete.ts`
- Create: `lib/gemini.ts`
- Create: `lib/git.ts`

- [ ] **Step 1: Create lib/gemini.ts**

Shared Gemini client initialization reused by both blog and SEO automation:

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("Error: GEMINI_API_KEY environment variable is required");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export function getModel(modelName = "gemini-2.0-flash") {
  return genAI.getGenerativeModel({ model: modelName });
}
```

- [ ] **Step 2: Create lib/autocomplete.ts**

Fetches Google Autocomplete suggestions for keyword research:

```typescript
export async function getAutocompleteSuggestions(query: string): Promise<string[]> {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    // Response format: [query, [suggestions]]
    return (data[1] as string[]) || [];
  } catch (error) {
    console.warn(`Autocomplete failed for "${query}":`, error);
    return [];
  }
}

export async function getKeywordsForRole(roleTitle: string): Promise<{
  coverLetterKeywords: string[];
  resumeKeywords: string[];
}> {
  const [coverLetterSuggestions, resumeSuggestions] = await Promise.all([
    getAutocompleteSuggestions(`${roleTitle} cover letter`),
    getAutocompleteSuggestions(`${roleTitle} resume`),
  ]);

  return {
    coverLetterKeywords: coverLetterSuggestions,
    resumeKeywords: resumeSuggestions,
  };
}
```

- [ ] **Step 3: Create lib/git.ts**

Git helpers extracted from blog-automation.ts pattern:

```typescript
import { execSync } from "child_process";
import { resolve } from "path";

const SCRIPT_DIR = resolve(import.meta.dirname, "..");
const OPENAPPLY_DIR = resolve(SCRIPT_DIR, "../openapply");

export function getOpenapplyDir(): string {
  return OPENAPPLY_DIR;
}

export function commitAndPush(filePaths: string[], message: string): void {
  for (const filePath of filePaths) {
    execSync(`git add "${filePath}"`, { cwd: OPENAPPLY_DIR, stdio: "inherit" });
  }
  execSync(`git commit -m "${message}"`, { cwd: OPENAPPLY_DIR, stdio: "inherit" });
  execSync("git push", { cwd: OPENAPPLY_DIR, stdio: "inherit" });
}
```

- [ ] **Step 4: Test autocomplete locally**

```bash
cd ../openapply-blog-automation && npx tsx -e "
import { getKeywordsForRole } from './lib/autocomplete.ts';
const result = await getKeywordsForRole('software engineer');
console.log('Cover letter keywords:', result.coverLetterKeywords);
console.log('Resume keywords:', result.resumeKeywords);
"
```

Expected: 10-20 suggestions per query like "software engineer cover letter example", "software engineer resume skills", etc.

- [ ] **Step 5: Commit**

```bash
cd ../openapply-blog-automation
git add lib/
git commit -m "feat: add shared libraries for autocomplete, gemini, and git"
```

---

## Task 3: Create Job Titles Database

**Repo:** `openapply-blog-automation/`

**Files:**
- Create: `job-titles.json`

- [ ] **Step 1: Create job-titles.json with ~130 curated titles**

Each entry has `slug`, `title`, and `category`. Categories: `tech`, `healthcare`, `business`, `creative`, `education`, `trades`, `finance`, `legal`, `sales`, `science`.

```json
[
  { "slug": "software-engineer", "title": "Software Engineer", "category": "tech" },
  { "slug": "data-analyst", "title": "Data Analyst", "category": "tech" },
  { "slug": "product-manager", "title": "Product Manager", "category": "tech" },
  { "slug": "ux-designer", "title": "UX Designer", "category": "creative" },
  { "slug": "project-manager", "title": "Project Manager", "category": "business" },
  { "slug": "registered-nurse", "title": "Registered Nurse", "category": "healthcare" },
  { "slug": "marketing-manager", "title": "Marketing Manager", "category": "business" },
  { "slug": "accountant", "title": "Accountant", "category": "finance" },
  { "slug": "teacher", "title": "Teacher", "category": "education" },
  { "slug": "sales-representative", "title": "Sales Representative", "category": "sales" }
]
```

Build out the full list to ~130 entries covering the most common job titles across all categories. Use BLS Occupational Outlook Handbook and LinkedIn's most in-demand jobs lists as reference. Prioritize roles with high search volume potential.

- [ ] **Step 2: Commit**

```bash
cd ../openapply-blog-automation
git add job-titles.json
git commit -m "feat: add curated job titles database (130 entries)"
```

---

## Task 4: Create Gemini Prompt Builders

**Repo:** `openapply-blog-automation/`

**Files:**
- Create: `prompts/cover-letter-page.ts`
- Create: `prompts/resume-page.ts`

- [ ] **Step 1: Create prompts/cover-letter-page.ts**

```typescript
export function buildCoverLetterPagePrompt(
  roleTitle: string,
  category: string,
  keywords: string[],
): string {
  return `Generate a complete cover letter example page for the role: "${roleTitle}".

Target SEO keywords to naturally incorporate: ${keywords.join(", ")}

The page must include these sections in order (use ## for section headings):

1. An opening paragraph (no heading) introducing why a tailored cover letter matters for ${roleTitle} positions specifically.

2. ## Sample Cover Letter for ${roleTitle} Positions
   Write a realistic, complete cover letter. Use a fictional but plausible applicant name. The letter should:
   - Be addressed to a realistic company (use a plausible but fictional name)
   - Reference specific skills and experiences relevant to ${roleTitle} roles
   - Be 300-400 words
   - Feel authentic, not templated

3. ## The Prompt Behind This Cover Letter
   Show a simplified, role-specific AI prompt that could generate this cover letter. The prompt shown should be tailored to ${roleTitle} — not a generic template. For example, a software engineer prompt might emphasize technical projects and GitHub contributions, while a nurse prompt might emphasize certifications and patient care experience. Format the prompt as a blockquote. Then explain in 2-3 paragraphs why each part of the prompt matters for this specific role:
   - What role-specific context improves the output (e.g., "for engineering roles, mentioning specific technologies" or "for healthcare roles, including certifications")
   - Why feeding in your actual resume matters
   - Why specifying the company and role produces better results
   This section should make readers understand how to craft better prompts for their specific role.

4. ## Why This Cover Letter Works
   3-4 bullet points explaining what makes this cover letter effective specifically for ${roleTitle} roles. Be concrete — reference industry norms, hiring patterns, or common expectations for this role.

5. A role-specific advice section. Pick the MOST RELEVANT ONE of these angles for a ${roleTitle} in the ${category} industry (or skip this section entirely if none fits naturally):
   - How to frame job hopping or short tenures due to layoffs/startup cycles
   - How to frame a career transition into this role
   - How to address employment gaps
   - Industry-specific norms (e.g., portfolios for designers, certifications for healthcare)
   - Remote vs in-office considerations for this role
   Give this section a specific, descriptive ## heading (NOT a generic heading like "Common Concerns").

Requirements:
- Write in markdown
- Do NOT include frontmatter
- Do NOT include a CTA section — I'll append that separately
- Use a knowledgeable, supportive tone
- Make content genuinely unique to this role — not generic advice with the job title swapped in
- Total length: 1200-1800 words`;
}

export const COVER_LETTER_SYSTEM_INSTRUCTION = `You are a career advisor and cover letter expert writing for OpenApply, an AI-powered job search assistant. You write practical, specific content that genuinely helps job seekers. You know the hiring landscape deeply — ATS systems, recruiter preferences, industry norms. Your tone is like a knowledgeable friend who's reviewed thousands of applications. You never sound like a marketing brochure. You write in markdown.`;
```

- [ ] **Step 2: Create prompts/resume-page.ts**

```typescript
export function buildResumePagePrompt(
  roleTitle: string,
  category: string,
  keywords: string[],
): string {
  return `Generate a complete resume guide page for the role: "${roleTitle}".

Target SEO keywords to naturally incorporate: ${keywords.join(", ")}

The page must include these sections in order (use ## for section headings):

1. An opening paragraph (no heading) about what makes a strong resume for ${roleTitle} positions and what recruiters in this field look for.

2. ## Key Skills for ${roleTitle} Resumes
   Two subsections:
   ### Technical Skills
   A bulleted list of 8-12 specific technical skills that ${roleTitle} positions require. Be specific to the role — not generic skills.
   ### Soft Skills
   A bulleted list of 5-8 soft skills particularly valued for ${roleTitle} roles, with a one-line explanation of why each matters in this context.

3. ## ATS Keywords for ${roleTitle} Positions
   A list of 15-20 specific keywords and phrases that ATS systems scan for in ${roleTitle} resumes. Organize by category (tools, methodologies, certifications, etc.). Explain briefly that these should appear naturally in the resume, not stuffed in.

4. A role-specific advice section. Pick the MOST RELEVANT ONE of these angles for a ${roleTitle} in the ${category} industry (or skip entirely if none fits):
   - How to present short tenures or frequent job changes in this field
   - How to transition into this role from a related field
   - How to handle career gaps specific to this industry
   - Certifications or credentials that matter for this role
   - Portfolio/project showcase expectations for this role
   Give this section a specific, descriptive ## heading.

5. ## Resume Tips for ${roleTitle} Positions
   3-4 actionable, specific tips for this role. Each tip should be something a ${roleTitle} candidate specifically needs to know, not generic advice like "use action verbs."

Requirements:
- Write in markdown
- Do NOT include frontmatter
- Do NOT include a CTA section
- Make content genuinely unique to this role
- Total length: 1000-1500 words`;
}

export const RESUME_SYSTEM_INSTRUCTION = `You are a resume expert and career advisor writing for OpenApply, an AI-powered job search assistant. You understand ATS systems, recruiter screening patterns, and what makes resumes stand out for specific roles. Your tone is practical and direct — like a friend who happens to be a hiring manager. You never sound like a marketing brochure. You write in markdown.`;
```

- [ ] **Step 3: Commit**

```bash
cd ../openapply-blog-automation
git add prompts/
git commit -m "feat: add Gemini prompt builders for cover letter and resume pages"
```

---

## Task 5: Create the SEO Automation Script

**Repo:** `openapply-blog-automation/`

**Files:**
- Create: `seo-automation.ts`

- [ ] **Step 1: Create seo-automation.ts**

```typescript
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "fs";
import { join, resolve } from "path";
import { getModel } from "./lib/gemini.ts";
import { getKeywordsForRole } from "./lib/autocomplete.ts";
import { getOpenapplyDir, commitAndPush } from "./lib/git.ts";
import { buildCoverLetterPagePrompt, COVER_LETTER_SYSTEM_INSTRUCTION } from "./prompts/cover-letter-page.ts";
import { buildResumePagePrompt, RESUME_SYSTEM_INSTRUCTION } from "./prompts/resume-page.ts";

// --- Config ---

const SCRIPT_DIR = resolve(import.meta.dirname);
const OPENAPPLY_DIR = getOpenapplyDir();
const COVER_LETTERS_DIR = join(OPENAPPLY_DIR, "astro/src/pages/cover-letters");
const RESUMES_DIR = join(OPENAPPLY_DIR, "astro/src/pages/resumes");
const JOB_TITLES_PATH = join(SCRIPT_DIR, "job-titles.json");
const TITLES_PER_RUN = 2;
const BASE_URL = "https://openapply.app";

// --- Types ---

type JobTitle = {
  slug: string;
  title: string;
  category: string;
};

// --- Helpers ---

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function getPublishedSlugs(dir: string): Set<string> {
  if (!existsSync(dir)) return new Set();
  return new Set(
    readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.replace(".md", ""))
  );
}

function buildCoverLetterFrontmatter(title: JobTitle): string {
  return `---
layout: ../../layouts/CoverLetterExample.astro
title: 'Cover Letter for ${title.title}s'
pubDate: ${todayISO()}
description: 'AI-generated cover letter example for ${title.title.toLowerCase()} positions with prompt breakdown and role-specific tips.'
author: 'OpenApply Team'
role: '${title.title}'
slug: '${title.slug}'
relatedResume: '/resumes/${title.slug}'
tags: ["Cover Letter", "${title.title}", "Job Search"]
---`;
}

function buildResumeFrontmatter(title: JobTitle): string {
  return `---
layout: ../../layouts/ResumeGuide.astro
title: 'Resume Guide for ${title.title}s'
pubDate: ${todayISO()}
description: 'Key skills, ATS keywords, and resume tips for ${title.title.toLowerCase()} positions.'
author: 'OpenApply Team'
role: '${title.title}'
slug: '${title.slug}'
relatedCoverLetter: '/cover-letters/${title.slug}'
tags: ["Resume", "${title.title}", "Job Search"]
---`;
}

const COVER_LETTER_CTA = `---

## Generate Your Own Cover Letter

Writing a tailored cover letter for every application is exhausting. [OpenApply](${BASE_URL}/?utm_source=seo&utm_medium=cover-letter-example&utm_campaign=cover-letters) generates personalized, job-specific cover letters from your resume and the job description — in one click.

[Try OpenApply free →](${BASE_URL}/?utm_source=seo&utm_medium=cover-letter-example&utm_campaign=cover-letters)`;

const RESUME_CTA = `---

## Check Your Resume Match Score

Not sure if your resume matches the job? [OpenApply](${BASE_URL}/?utm_source=seo&utm_medium=resume-guide&utm_campaign=resumes) analyzes your resume against any job description and shows you exactly what to improve — skills gaps, missing keywords, and formatting issues.

[Check your resume match →](${BASE_URL}/?utm_source=seo&utm_medium=resume-guide&utm_campaign=resumes)`;

// --- Generation ---

async function generatePage(
  prompt: string,
  systemInstruction: string,
): Promise<string> {
  const model = getModel();
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    systemInstruction: { role: "model", parts: [{ text: systemInstruction }] },
  });

  return result.response
    .text()
    .replace(/^(?:Okay|Here(?:'s| is)|Sure|Alright|Great|Let me|I've)[^\n]*:\s*\n+/, "")
    .trim();
}

// --- Main ---

async function main() {
  const allTitles: JobTitle[] = JSON.parse(readFileSync(JOB_TITLES_PATH, "utf-8"));
  const publishedCoverLetters = getPublishedSlugs(COVER_LETTERS_DIR);
  const publishedResumes = getPublishedSlugs(RESUMES_DIR);

  // Find titles where BOTH pages are missing
  const pending = allTitles.filter(
    (t) => !publishedCoverLetters.has(t.slug) || !publishedResumes.has(t.slug)
  );

  if (pending.length === 0) {
    console.log("All job titles have been generated. Nothing to do.");
    process.exit(0);
  }

  console.log(`${pending.length} job titles remaining\n`);

  const batch = pending.slice(0, TITLES_PER_RUN);
  const allFiles: string[] = [];

  // Ensure directories exist
  if (!existsSync(COVER_LETTERS_DIR)) mkdirSync(COVER_LETTERS_DIR, { recursive: true });
  if (!existsSync(RESUMES_DIR)) mkdirSync(RESUMES_DIR, { recursive: true });

  for (const title of batch) {
    console.log(`=== ${title.title} ===\n`);

    // Step 1: Keyword research
    console.log("Researching keywords...");
    const keywords = await getKeywordsForRole(title.title);
    console.log(`  Cover letter keywords: ${keywords.coverLetterKeywords.length}`);
    console.log(`  Resume keywords: ${keywords.resumeKeywords.length}\n`);

    // Step 2: Generate cover letter page
    if (!publishedCoverLetters.has(title.slug)) {
      console.log("Generating cover letter page...");
      const coverLetterPrompt = buildCoverLetterPagePrompt(
        title.title,
        title.category,
        keywords.coverLetterKeywords,
      );
      const coverLetterBody = await generatePage(coverLetterPrompt, COVER_LETTER_SYSTEM_INSTRUCTION);
      const coverLetterContent = `${buildCoverLetterFrontmatter(title)}\n\n${coverLetterBody}\n\n${COVER_LETTER_CTA}\n`;
      const coverLetterPath = join(COVER_LETTERS_DIR, `${title.slug}.md`);
      writeFileSync(coverLetterPath, coverLetterContent, "utf-8");
      allFiles.push(coverLetterPath);
      console.log(`  Written: ${coverLetterPath}\n`);
    }

    // Step 3: Generate resume page
    if (!publishedResumes.has(title.slug)) {
      console.log("Generating resume page...");
      const resumePrompt = buildResumePagePrompt(
        title.title,
        title.category,
        keywords.resumeKeywords,
      );
      const resumeBody = await generatePage(resumePrompt, RESUME_SYSTEM_INSTRUCTION);
      const resumeContent = `${buildResumeFrontmatter(title)}\n\n${resumeBody}\n\n${RESUME_CTA}\n`;
      const resumePath = join(RESUMES_DIR, `${title.slug}.md`);
      writeFileSync(resumePath, resumeContent, "utf-8");
      allFiles.push(resumePath);
      console.log(`  Written: ${resumePath}\n`);
    }
  }

  // Step 4: Commit and push all pages
  if (allFiles.length > 0) {
    console.log(`Committing ${allFiles.length} pages...`);
    const slugs = batch.map((t) => t.slug).join(", ");
    commitAndPush(allFiles, `content: add SEO pages for ${slugs}`);
    console.log("\nDone!");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Test script compiles**

```bash
cd ../openapply-blog-automation && npx tsx -e "console.log('imports ok')"
```

- [ ] **Step 3: Commit**

```bash
cd ../openapply-blog-automation
git add seo-automation.ts
git commit -m "feat: add SEO page generation automation script"
```

---

## Task 6: Create Astro Layouts

**Repo:** `openapply/`

**Files:**
- Create: `astro/src/layouts/CoverLetterExample.astro`
- Create: `astro/src/layouts/ResumeGuide.astro`

- [ ] **Step 1: Create CoverLetterExample.astro**

Based on the existing `BlogPost.astro` layout but with cover-letter-specific schema, breadcrumbs, and a related resume link. Key differences from BlogPost:
- Breadcrumbs: Home → Cover Letters → [title]
- Schema type: `Article` with `articleSection: "Cover Letter Examples"`
- Related resume link rendered from `frontmatter.relatedResume`
- No `RelatedPosts` or `SocialShare` components

```astro
---
import Layout from './Layout.astro';
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';
import Breadcrumbs from '../components/Breadcrumbs.astro';

const { frontmatter } = Astro.props;
const currentPath = Astro.url.pathname;

const pageTitle = `${frontmatter.title} | OpenApply`;
const pageDescription = frontmatter.description || frontmatter.title;
const canonicalUrl = new URL(currentPath, Astro.site || 'https://openapply.app').href;
const ogImage = 'https://openapply.app/og-image.png';
const publishedTime = frontmatter.pubDate ? new Date(frontmatter.pubDate).toISOString() : undefined;

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": frontmatter.title,
  "description": pageDescription,
  "image": ogImage,
  "datePublished": publishedTime,
  "articleSection": "Cover Letter Examples",
  "author": {
    "@type": "Organization",
    "name": "OpenApply"
  },
  "publisher": {
    "@type": "Organization",
    "name": "OpenApply",
    "logo": {
      "@type": "ImageObject",
      "url": "https://openapply.app/favicon.ico"
    }
  },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": canonicalUrl
  },
  ...(frontmatter.tags && frontmatter.tags.length > 0 && {
    "keywords": frontmatter.tags.join(", ")
  })
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://openapply.app" },
    { "@type": "ListItem", "position": 2, "name": "Cover Letters", "item": "https://openapply.app/cover-letters" },
    { "@type": "ListItem", "position": 3, "name": frontmatter.title, "item": canonicalUrl }
  ]
};

const breadcrumbItems = [
  { name: "Home", url: "/" },
  { name: "Cover Letters", url: "/cover-letters" },
  { name: frontmatter.title, url: currentPath }
];
---

<Layout
  title={pageTitle}
  description={pageDescription}
  ogImage={ogImage}
  ogType="article"
  canonicalUrl={canonicalUrl}
  publishedTime={publishedTime}
  articleTags={frontmatter.tags}
  keywords={frontmatter.tags ? frontmatter.tags.join(", ") : undefined}
>
  <Header showHashLinks={false} currentPath={currentPath} />

  <script type="application/ld+json" set:html={JSON.stringify(articleSchema)} />
  <script type="application/ld+json" set:html={JSON.stringify(breadcrumbSchema)} />

  <main class="min-h-screen bg-background">
    <article class="container mx-auto px-4 py-12 max-w-4xl">
      <Breadcrumbs items={breadcrumbItems} />

      <header class="mb-12 border-b border-border pb-8">
        <h1 class="text-4xl md:text-5xl font-bold text-foreground mb-4">
          {frontmatter.title}
        </h1>
        <div class="flex flex-wrap gap-4 text-sm text-muted-foreground">
          {frontmatter.pubDate && (
            <time datetime={frontmatter.pubDate}>
              {new Date(frontmatter.pubDate).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
              })}
            </time>
          )}
        </div>
        {frontmatter.tags && frontmatter.tags.length > 0 && (
          <div class="flex flex-wrap gap-2 mt-4">
            {frontmatter.tags.map((tag: string) => (
              <span class="px-3 py-1 text-xs font-medium bg-secondary text-secondary-foreground rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>

      <div class="prose prose-lg dark:prose-invert max-w-none">
        <slot />
      </div>

      {frontmatter.relatedResume && (
        <div class="mt-12 p-6 border border-border rounded-lg bg-secondary/30">
          <p class="text-foreground font-medium">
            Also see: <a href={frontmatter.relatedResume} class="text-primary underline hover:text-primary/80">
              Resume Guide for {frontmatter.role}s →
            </a>
          </p>
        </div>
      )}
    </article>
  </main>
  <Footer />
</Layout>
```

Copy the `<style>` block from `BlogPost.astro` (lines 157-315) and append it to this file — the prose styles are identical.

- [ ] **Step 2: Create ResumeGuide.astro**

Same structure as CoverLetterExample.astro with these differences:
- Breadcrumbs: Home → Resumes → [title]
- Schema `articleSection`: "Resume Guides"
- Related link uses `frontmatter.relatedCoverLetter` instead of `relatedResume`
- Related link text: "Cover Letter for {role}s →"

Create by copying CoverLetterExample.astro and making these substitutions:
- `"Cover Letter Examples"` → `"Resume Guides"`
- `"Cover Letters"` in breadcrumbs → `"Resumes"`
- `/cover-letters` in breadcrumb URL → `/resumes`
- `frontmatter.relatedResume` → `frontmatter.relatedCoverLetter`
- `Resume Guide for` → `Cover Letter for`

- [ ] **Step 3: Verify layouts render**

Create a test markdown file to verify:

```bash
mkdir -p astro/src/pages/cover-letters
cat > astro/src/pages/cover-letters/test.md << 'EOF'
---
layout: ../../layouts/CoverLetterExample.astro
title: 'Cover Letter for Software Engineers'
pubDate: 2026-03-19
description: 'Test page'
author: 'OpenApply Team'
role: 'Software Engineer'
slug: 'test'
relatedResume: '/resumes/test'
tags: ["Cover Letter", "Software Engineer"]
---

## Sample Cover Letter

This is a test page to verify the layout renders correctly.
EOF
```

```bash
cd astro && pnpm build 2>&1 | tail -20
```

Expected: Build succeeds. Then remove the test file:
```bash
rm astro/src/pages/cover-letters/test.md && rmdir astro/src/pages/cover-letters
```

- [ ] **Step 4: Commit**

```bash
git add astro/src/layouts/CoverLetterExample.astro astro/src/layouts/ResumeGuide.astro
git commit -m "feat: add Astro layouts for cover letter and resume SEO pages"
```

---

## Task 7: Create Index Pages

**Repo:** `openapply/`

**Files:**
- Create: `astro/src/pages/cover-letters.astro`
- Create: `astro/src/pages/resumes.astro`

- [ ] **Step 1: Create cover-letters.astro**

Based on the existing `blog.astro` pattern — glob all `.md` files in the directory, sort by date, render a card grid:

```astro
---
import Layout from '../layouts/Layout.astro'
import Header from "../components/Header.astro";
import Footer from "../components/Footer.astro";
import Breadcrumbs from "../components/Breadcrumbs.astro";

type PostModule = {
  url?: string;
  frontmatter: {
    title: string;
    description?: string;
    pubDate?: string;
    role?: string;
    tags?: string[];
  };
}

const posts = Object.values(import.meta.glob<PostModule>('./cover-letters/*.md', { eager: true }))
  .sort((a, b) => {
    const dateA = a.frontmatter.pubDate ? new Date(a.frontmatter.pubDate).getTime() : 0;
    const dateB = b.frontmatter.pubDate ? new Date(b.frontmatter.pubDate).getTime() : 0;
    return dateB - dateA;
  });
const currentPath = Astro.url.pathname;

const pageTitle = "Cover Letter Examples by Job Title | OpenApply";
const pageDescription = "AI-generated cover letter examples for every job title. See sample cover letters, the prompts behind them, and role-specific tips.";
const canonicalUrl = new URL('/cover-letters', Astro.site || 'https://openapply.app').href;

const breadcrumbItems = [
  { name: "Home", url: "/" },
  { name: "Cover Letters", url: "/cover-letters" }
];
---

<Layout
  title={pageTitle}
  description={pageDescription}
  canonicalUrl={canonicalUrl}
  ogType="website"
>
  <Header showHashLinks={false} currentPath={currentPath} />

  <main class="min-h-screen bg-background">
    <div class="container mx-auto px-4 py-12 max-w-4xl">
      <Breadcrumbs items={breadcrumbItems} />

      <h1 class="text-4xl md:text-5xl font-bold text-foreground mb-4">Cover Letter Examples</h1>
      <p class="text-lg text-muted-foreground mb-12 max-w-3xl">
        Browse AI-generated cover letter examples for specific job titles. Each includes a sample cover letter,
        the prompt used to generate it, and role-specific advice.
      </p>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        {posts.map((post) => (
          <article class="border border-border rounded-lg p-6 hover:border-primary transition-colors flex flex-col h-full">
            <a href={post.url} class="group flex flex-col h-full">
              <h2 class="text-xl font-bold text-foreground group-hover:text-primary transition-colors mb-3">
                {post.frontmatter.title}
              </h2>
              {post.frontmatter.description && (
                <p class="text-muted-foreground mb-4 text-sm line-clamp-3 flex-grow">{post.frontmatter.description}</p>
              )}
              <div class="mt-auto">
                {post.frontmatter.tags && post.frontmatter.tags.length > 0 && (
                  <div class="flex flex-wrap gap-2">
                    {post.frontmatter.tags.map((tag) => (
                      <span class="px-2 py-1 text-xs font-medium bg-secondary text-secondary-foreground rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </a>
          </article>
        ))}
      </div>

      {posts.length === 0 && (
        <p class="text-muted-foreground text-center py-12">Cover letter examples coming soon!</p>
      )}
    </div>
  </main>
  <Footer />
</Layout>
```

- [ ] **Step 2: Create resumes.astro**

Copy `cover-letters.astro` and make these substitutions:
- Glob path: `'./resumes/*.md'`
- Page title: `"Resume Guides by Job Title | OpenApply"`
- Page description: `"Resume guides for every job title. Key skills, ATS keywords, and role-specific tips to land more interviews."`
- Canonical URL: `/resumes`
- Breadcrumb: `"Resumes"` at `/resumes`
- H1: `"Resume Guides"`
- Description paragraph: `"Browse resume guides for specific job titles. Each includes key skills, ATS keywords, and actionable tips for your role."`
- Empty state: `"Resume guides coming soon!"`

- [ ] **Step 3: Verify build**

```bash
cd astro && pnpm build 2>&1 | tail -10
```

Expected: Build succeeds with the new index pages (they'll show empty since no content pages exist yet).

- [ ] **Step 4: Commit**

```bash
git add astro/src/pages/cover-letters.astro astro/src/pages/resumes.astro
git commit -m "feat: add index pages for cover letters and resume guides"
```

---

## Task 8: Create GitHub Actions Workflow

**Repo:** `openapply-blog-automation/`

**Files:**
- Create: `.github/workflows/seo-automation.yml`

- [ ] **Step 1: Create seo-automation.yml**

```yaml
name: SEO Page Generation

on:
  schedule:
    # Daily at 2 PM UTC
    - cron: '0 14 * * *'
  workflow_dispatch: # Manual trigger

jobs:
  generate-seo-pages:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout blog automation (this repo)
        uses: actions/checkout@v4

      - name: Checkout openapply
        uses: actions/checkout@v4
        with:
          repository: SergeyKhval/openapply
          token: ${{ secrets.OPENAPPLY_PAT }}
          path: openapply

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install dependencies
        run: npm install

      - name: Configure git
        run: |
          cd openapply
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: Random delay (0-4 hours)
        if: github.event_name == 'schedule'
        run: sleep $((RANDOM % 14400))

      - name: Generate SEO pages, commit, and push
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
        run: npx tsx seo-automation.ts
```

- [ ] **Step 2: Commit**

```bash
cd ../openapply-blog-automation
git add .github/workflows/seo-automation.yml
git commit -m "ci: add daily GitHub Actions workflow for SEO page generation"
```

---

## Task 9: End-to-End Test

- [ ] **Step 1: Run the SEO automation locally**

```bash
cd ../openapply-blog-automation && GEMINI_API_KEY=<your-key> npx tsx seo-automation.ts
```

Expected output:
- Picks first 2 job titles from `job-titles.json`
- Fetches autocomplete keywords for each
- Generates 4 pages (2 cover letters + 2 resumes)
- Writes `.md` files to `astro/src/pages/cover-letters/` and `astro/src/pages/resumes/`
- Commits and pushes to openapply repo

- [ ] **Step 2: Verify Astro builds with generated pages**

```bash
cd /home/sergey/Documents/work/openapply/astro && pnpm build 2>&1 | tail -20
```

Expected: Build succeeds, new pages are included.

- [ ] **Step 3: Verify pages render correctly in dev**

```bash
cd /home/sergey/Documents/work/openapply/astro && pnpm dev
```

Check in browser:
- `/cover-letters` — index page lists the generated pages
- `/cover-letters/software-engineer` (or whichever was first) — full page with sample letter, prompt section, tips
- `/resumes/software-engineer` — full page with skills, keywords, tips
- Cross-links between cover letter and resume pages work
- CTAs have correct UTM parameters

- [ ] **Step 4: Submit sitemap to Google Search Console**

After first batch deploys to production, submit the sitemap:
```bash
# Use the GSC MCP tool or manually submit at https://search.google.com/search-console
```

- [ ] **Step 5: Push all changes**

```bash
cd ../openapply-blog-automation && git push
cd /home/sergey/Documents/work/openapply && git push
```
