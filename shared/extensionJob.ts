// The job the browser extension read from a posting, handed to /save in the
// URL fragment: #job=<base64url(deflate(JSON))>. The fragment never reaches
// a server, and compression keeps a 15,000-character description at a few KB.
// The encoder is extension/src/links.js (encodeJob); keep the two in step.

import { sanitizeJobPosting, type JobPosting } from "./jobPosting";

export const EXTENSION_JOB_PARAM = "job";

export const EXTENSION_JOB_LIMITS = {
  url: 2000,
  title: 300,
  company: 300,
  location: 300,
  description: 15000,
} as const;

// A payload inflating past this isn't one the extension wrote
const MAX_INFLATED_BYTES = 256 * 1024;

export type ExtensionJob = {
  url: string;
  title: string;
  company: string;
  location: string;
  description: string;
  // When the page says it was posted; absent when it doesn't
  posting?: JobPosting;
};

function base64UrlToBytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  try {
    const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

async function inflate(bytes: Uint8Array): Promise<string | null> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    const reader = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    })
      .pipeThrough(new DecompressionStream("deflate"))
      .getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_INFLATED_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(joined);
}

function isWebUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

function text(value: unknown, limit: number): string {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

/**
 * Reads the extension's job from a location hash ("#job=..."). Resolves to
 * null when there is none or it isn't valid: callers fall back to the link.
 */
export async function decodeExtensionJob(hash: string): Promise<ExtensionJob | null> {
  const encoded = new URLSearchParams(hash.replace(/^#/, "")).get(EXTENSION_JOB_PARAM);
  if (!encoded) return null;
  const bytes = base64UrlToBytes(encoded);
  if (!bytes) return null;
  const json = await inflate(bytes);
  if (!json) return null;

  let data: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null) return null;
    data = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  if (data.v !== 1) return null;

  const job: ExtensionJob = {
    url: text(data.url, EXTENSION_JOB_LIMITS.url),
    title: text(data.title, EXTENSION_JOB_LIMITS.title),
    company: text(data.company, EXTENSION_JOB_LIMITS.company),
    location: text(data.location, EXTENSION_JOB_LIMITS.location),
    description: text(data.description, EXTENSION_JOB_LIMITS.description),
  };
  if (!isWebUrl(job.url) || !job.description) return null;
  const posting = sanitizeJobPosting(data.posting);
  if (posting) job.posting = posting;
  return job;
}
