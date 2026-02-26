import { GoogleGenerativeAI } from "@google/generative-ai";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import { execSync } from "child_process";

// --- Config ---

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const AUDIENCE_ID = "0378a299-a329-4239-944d-c8b787329e76";
const BASE_URL = "https://openapply.app";

const REPO_ROOT = resolve(import.meta.dirname, "../..");
const BLOG_DIR = join(REPO_ROOT, "astro/src/pages/blog");
const TOPICS_PATH = join(import.meta.dirname, "blog-topics.json");

if (!GEMINI_API_KEY || !RESEND_API_KEY) {
  console.error("Error: GEMINI_API_KEY and RESEND_API_KEY environment variables are required");
  process.exit(1);
}

// --- Types ---

type Topic = {
  slug: string;
  title: string;
  keywords: string[];
  category: string;
  cta: "cover-letter" | "resume-match" | "tracker";
};

// --- CTA blocks ---

const ctaBlocks: Record<string, string> = {
  "cover-letter": `---

## Write Your Cover Letter in Seconds

Crafting a tailored cover letter for every application is exhausting. [OpenApply](https://openapply.app/app/) generates personalized, job-specific cover letters from your resume and the job description — in one click. Stop staring at a blank page and start applying faster.

[Try OpenApply free →](https://openapply.app/app/)`,

  "resume-match": `---

## See How Your Resume Stacks Up

Not sure if your resume matches the job? [OpenApply](https://openapply.app/app/) analyzes your resume against any job description and tells you exactly what to improve — keywords, skills gaps, and formatting issues. Get actionable feedback in seconds.

[Check your resume match →](https://openapply.app/app/)`,

  tracker: `---

## Stop Losing Track of Your Applications

When you're applying to dozens of jobs, things slip through the cracks. [OpenApply](https://openapply.app/app/) helps you track every application, follow-up, and interview in one place — just paste a job link and it auto-fills the details. Free to use, no credit card required.

[Start tracking your applications →](https://openapply.app/app/)`,
};

// --- Helpers ---

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function buildFrontmatter(topic: Topic): string {
  const tagMap: Record<string, string[]> = {
    "cover-letter": ["Cover Letter", "Job Search", "Career Tips"],
    resume: ["Resume", "Job Search", "Career Tips"],
    "job-search": ["Job Search", "Career Strategy", "Productivity"],
    interview: ["Interview", "Career Tips", "Job Search"],
  };
  const tags = tagMap[topic.category] || ["Job Search", "Career Tips"];

  return `---
layout: ../../layouts/BlogPost.astro
title: '${topic.title.replace(/'/g, "''")}'
pubDate: ${todayISO()}
description: '${topic.keywords[0]} - practical tips and strategies to help you stand out in your job search.'
author: 'OpenApply Team'
image:
    url: ''
    alt: ''
tags: [${tags.map((t) => `"${t}"`).join(", ")}]
---`;
}

function buildPostPrompt(topic: Topic): string {
  return `Write a blog post titled "${topic.title}".

Target SEO keywords: ${topic.keywords.join(", ")}

Requirements:
- Write 1000-1500 words of helpful, practical content
- Use a friendly, knowledgeable tone — like advice from a friend who's been through it
- Do NOT be salesy or promotional
- Structure with clear H2 (##) and H3 (###) headings for SEO
- Include specific, actionable tips — not generic fluff
- Use examples where possible
- Naturally weave in the target keywords without keyword stuffing
- Do NOT start with the title or repeat the title as a heading — the H1 title is already rendered by the page layout
- Start directly with the first paragraph or first H2 section
- Do NOT include any frontmatter — I'll add that separately
- Do NOT include a CTA section at the end — I'll append that separately
- End the main content naturally (a brief conclusion paragraph is fine)

Write the markdown body content only.`;
}

// --- Step 1: Find next topic ---

function findNextTopic(): Topic | null {
  const topics: Topic[] = JSON.parse(readFileSync(TOPICS_PATH, "utf-8"));
  const pending = topics.filter((t) => !existsSync(join(BLOG_DIR, `${t.slug}.md`)));
  if (pending.length === 0) return null;
  console.log(`${pending.length} topics remaining`);
  return pending[Math.floor(Math.random() * pending.length)];
}

// --- Step 2: Generate blog post ---

async function generatePost(topic: Topic): Promise<string> {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: buildPostPrompt(topic) }] }],
    systemInstruction: {
      role: "model",
      parts: [
        {
          text: "You are a career advice blog writer for OpenApply, an AI-powered job search assistant. Write helpful, practical blog posts that genuinely help job seekers. Your tone is knowledgeable and supportive — like a mentor who's helped hundreds of people land jobs. You never sound like a marketing brochure. You write in markdown.",
        },
      ],
    },
  });

  const raw = result.response.text();
  const body = raw.replace(/^(?:Okay|Here(?:'s| is)|Sure|Alright|Great|Let me|I've)[^\n]*:\s*\n+/, "").trim();
  const frontmatter = buildFrontmatter(topic);
  const cta = ctaBlocks[topic.cta] || ctaBlocks["tracker"];
  return `${frontmatter}\n\n${body}\n\n${cta}\n`;
}

// --- Step 3: Commit and push ---

function commitAndPush(topic: Topic): void {
  const filePath = join(BLOG_DIR, `${topic.slug}.md`);
  execSync(`git add "${filePath}"`, { cwd: REPO_ROOT, stdio: "inherit" });
  execSync(
    `git commit -m "content: add ${topic.slug} blog post"`,
    { cwd: REPO_ROOT, stdio: "inherit" }
  );
  execSync("git push", { cwd: REPO_ROOT, stdio: "inherit" });
}

// --- Step 4: Generate teaser and send broadcast ---

async function generateTeaser(title: string, body: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You're writing a short email teaser for a blog post. The email will have the blog title as the heading, then your teaser text, then a "Read the full post" button.

Blog title: "${title}"

Blog content:
${body.slice(0, 3000)}

Write 2-3 sentences that:
- Hook the reader with a relatable pain point or intriguing insight from the post
- Tease the value they'll get by reading (specific tips, examples, frameworks)
- Create curiosity without giving everything away
- Sound conversational and human, not salesy or clickbaity

Return ONLY the teaser text, no quotes, no formatting.`,
          },
        ],
      },
    ],
    systemInstruction: {
      role: "model",
      parts: [
        {
          text: "You write concise, compelling email copy for a job search tool called OpenApply. Your tone is friendly and direct — like a helpful friend, never a marketer.",
        },
      ],
    },
  });

  return result.response.text().trim();
}

function buildEmailHtml(title: string, subject: string, teaser: string, url: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="padding:32px 40px 24px;text-align:center;">
              <span style="font-size:20px;font-weight:700;color:#18181b;letter-spacing:-0.5px;">OpenApply</span>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 32px;">
              <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#18181b;line-height:1.3;">
                ${title}
              </h1>
              <p style="margin:0 0 24px;font-size:16px;color:#52525b;line-height:1.6;">
                ${teaser}
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:6px;background-color:#18181b;">
                    <a href="${url}" target="_blank" style="display:inline-block;padding:12px 24px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;">
                      Read the full post &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #e4e4e7;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;color:#a1a1aa;">
                You're receiving this because you signed up for OpenApply.
              </p>
              <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="font-size:13px;color:#a1a1aa;text-decoration:underline;">
                Unsubscribe
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendBroadcast(topic: Topic, postContent: string): Promise<void> {
  const { Resend } = await import("resend");
  const resend = new Resend(RESEND_API_KEY);

  const slug = topic.slug;
  const postUrl = `${BASE_URL}/blog/${slug}/?utm_source=newsletter&utm_medium=email&utm_campaign=${slug}`;
  const subject = topic.title;

  // Strip frontmatter and CTA for teaser generation
  const body = postContent
    .replace(/^---\n[\s\S]*?\n---\n*/, "")
    .replace(/\n---\n\n## (Write Your Cover Letter|See How Your Resume|Stop Losing Track)[\s\S]*$/, "")
    .trim();

  console.log("Generating email teaser...");
  const teaser = await generateTeaser(topic.title, body);
  console.log(`Teaser: ${teaser}\n`);

  const html = buildEmailHtml(topic.title, subject, teaser, postUrl);

  console.log("Creating broadcast...");
  const broadcast = await resend.broadcasts.create({
    name: `Blog: ${subject}`,
    audienceId: AUDIENCE_ID,
    from: "OpenApply <hello@openapply.app>",
    subject,
    html,
  });

  if (broadcast.error) {
    console.error("Failed to create broadcast:", broadcast.error);
    process.exit(1);
  }

  console.log(`Broadcast created: ${broadcast.data!.id}`);
  console.log("Sending broadcast...");

  const sent = await resend.broadcasts.send(broadcast.data!.id);

  if (sent.error) {
    console.error("Failed to send broadcast:", sent.error);
    process.exit(1);
  }

  console.log(`Broadcast sent: ${sent.data!.id}`);
}

// --- Main ---

async function main() {
  const topic = findNextTopic();
  if (!topic) {
    console.log("All topics have been generated. Nothing to do.");
    process.exit(0);
  }

  console.log(`\n=== Generating: ${topic.slug} ===\n`);

  // Generate blog post
  console.log("Step 1: Generating blog post with Gemini...");
  const postContent = await generatePost(topic);
  const outPath = join(BLOG_DIR, `${topic.slug}.md`);
  writeFileSync(outPath, postContent, "utf-8");
  console.log(`Written: ${outPath}\n`);

  // Commit and push
  console.log("Step 2: Committing and pushing...");
  commitAndPush(topic);
  console.log();

  // Send broadcast
  console.log("Step 3: Sending email broadcast...");
  await sendBroadcast(topic, postContent);

  console.log(`\n=== Done: ${topic.slug} ===\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
