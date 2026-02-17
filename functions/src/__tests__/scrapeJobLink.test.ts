import { describe, it, expect, vi } from "vitest";

// Mock firebase-admin/firestore before any imports to prevent initialization error
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({}),
  FieldValue: { serverTimestamp: () => "mock-ts" },
}));

vi.mock("firebase-functions/v2/firestore", () => ({
  onDocumentCreated: (opts: unknown, fn: unknown) => fn,
}));

vi.mock("puppeteer-core", () => ({ default: {} }));
vi.mock("@sparticuz/chromium", () => ({ default: { args: [] } }));

import { cleanHtml } from "../scrapeJobLink";

describe("cleanHtml", () => {
  it("removes script elements", () => {
    const result = cleanHtml("<html><body><script>alert('hi')</script><p>Hello</p></body></html>");
    expect(result).not.toContain("<script");
    expect(result).toContain("<p>Hello</p>");
  });

  it("removes style elements", () => {
    const result = cleanHtml("<html><body><style>.foo{color:red}</style><p>Hello</p></body></html>");
    expect(result).not.toContain("<style");
    expect(result).toContain("<p>Hello</p>");
  });

  it("removes svg elements", () => {
    const result = cleanHtml("<html><body><svg><circle r='10'/></svg><p>Hello</p></body></html>");
    expect(result).not.toContain("<svg");
    expect(result).toContain("<p>Hello</p>");
  });

  it("removes img elements", () => {
    const result = cleanHtml('<html><body><img src="photo.jpg"/><p>Hello</p></body></html>');
    expect(result).not.toContain("<img");
    expect(result).toContain("<p>Hello</p>");
  });

  it("removes form elements", () => {
    const result = cleanHtml("<html><body><form><input type='text'/></form><p>Hello</p></body></html>");
    expect(result).not.toContain("<form");
    expect(result).not.toContain("<input");
    expect(result).toContain("<p>Hello</p>");
  });

  it("removes empty container elements", () => {
    const result = cleanHtml("<html><body><div class='empty'></div><p>Content</p></body></html>");
    expect(result).toContain("<p>Content</p>");
  });

  it("strips all attributes", () => {
    const result = cleanHtml('<html><body><p class="foo" id="bar" data-x="1">Hello</p></body></html>');
    expect(result).not.toContain('class=');
    expect(result).not.toContain('id=');
    expect(result).not.toContain('data-x');
    expect(result).toContain("<p>Hello</p>");
  });

  it("preserves list structures", () => {
    const result = cleanHtml("<html><body><ul><li>Item 1</li><li>Item 2</li></ul></body></html>");
    expect(result).toContain("<ul>");
    expect(result).toContain("<li>");
  });

  it("preserves table structures", () => {
    const result = cleanHtml("<html><body><table><tr><td>Cell</td></tr></table></body></html>");
    expect(result).toContain("<table>");
    expect(result).toContain("<tr>");
    expect(result).toContain("<td>");
  });

  it("flattens wrapper divs with no direct text", () => {
    const result = cleanHtml("<html><body><div><p>Hello</p></div></body></html>");
    expect(result).toContain("<p>Hello</p>");
    expect(result).not.toMatch(/<div><p>Hello<\/p><\/div>/);
  });

  it("handles empty HTML", () => {
    const result = cleanHtml("<html><body></body></html>");
    expect(result).toContain("<html>");
  });

  it("handles minimal HTML with just text", () => {
    const result = cleanHtml("<html><body><p>Just text</p></body></html>");
    expect(result).toContain("Just text");
  });
});
