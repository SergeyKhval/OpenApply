// Downloads of a tailored resume: a DOCX built in the browser (docx, loaded
// only on click) and a print view for "Save as PDF". Both follow the same
// ATS-friendly layout: one column, plain section headings, real bullets, no
// tables, columns, icons, headers or footers.
import type { TailoredDoc } from "@/lib/tailoredResume";

export type ExportMeta = {
  companyName?: string | null;
  position?: string | null;
};

/** The candidate's name: the first line of the top block. */
export function candidateName(doc: TailoredDoc): string {
  const top = doc.sections.find((section) => section.heading === null);
  return top?.lines[0]?.text.trim() ?? "";
}

/** "Sarah Chen - Globex Senior Frontend Engineer", safe as a file name. */
export function exportFileName(doc: TailoredDoc, meta: ExportMeta, extension: "docx" | "pdf"): string {
  const job = [meta.companyName, meta.position].filter(Boolean).join(" ");
  const base = [candidateName(doc) || "Resume", job].filter(Boolean).join(" - ");
  const safe = base
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return `${safe || "Resume"}.${extension}`;
}

// Sizes in half-points (docx): 16pt name, 12pt headings, 10.5pt body
const NAME_SIZE = 32;
const HEADING_SIZE = 24;
const BODY_SIZE = 21;
const FONT = "Calibri";

export async function tailoredResumeDocx(doc: TailoredDoc): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, BorderStyle } = await import("docx");
  const paragraphs: InstanceType<typeof Paragraph>[] = [];

  doc.sections.forEach((section, sectionIndex) => {
    if (section.heading) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: section.heading.toUpperCase(), bold: true, size: HEADING_SIZE, font: FONT })],
          spacing: { before: 240, after: 80 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "999999", space: 2 } },
        }),
      );
    }
    section.lines.forEach((line, lineIndex) => {
      const isName = section.heading === null && sectionIndex === 0 && lineIndex === 0;
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: line.text, bold: isName, size: isName ? NAME_SIZE : BODY_SIZE, font: FONT })],
          ...(line.bullet ? { bullet: { level: 0 } } : {}),
          spacing: { after: line.bullet ? 40 : 60 },
        }),
      );
    });
  });

  const document = new Document({
    creator: "OpenApply",
    styles: { default: { document: { run: { font: FONT, size: BODY_SIZE } } } },
    sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } }, children: paragraphs }],
  });
  return Packer.toBlob(document);
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

/** A standalone page for the browser's "Save as PDF". */
export function tailoredResumeHtml(doc: TailoredDoc, title: string): string {
  const body = doc.sections
    .map((section, sectionIndex) => {
      const heading = section.heading ? `<h2>${escapeHtml(section.heading)}</h2>` : "";
      const items: string[] = [];
      let bullets: string[] = [];
      const flush = () => {
        if (bullets.length) items.push(`<ul>${bullets.join("")}</ul>`);
        bullets = [];
      };
      section.lines.forEach((line, lineIndex) => {
        if (line.bullet) {
          bullets.push(`<li>${escapeHtml(line.text)}</li>`);
          return;
        }
        flush();
        const isName = section.heading === null && sectionIndex === 0 && lineIndex === 0;
        items.push(isName ? `<h1>${escapeHtml(line.text)}</h1>` : `<p>${escapeHtml(line.text)}</p>`);
      });
      flush();
      return `<section>${heading}${items.join("")}</section>`;
    })
    .join("");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
@page { margin: 14mm 16mm; }
body { font-family: Calibri, Carlito, "Segoe UI", Arial, sans-serif; font-size: 10.5pt; line-height: 1.35; color: #000; margin: 0; }
h1 { font-size: 16pt; margin: 0 0 2pt; }
h2 { font-size: 12pt; text-transform: uppercase; border-bottom: 0.5pt solid #999; margin: 12pt 0 4pt; padding-bottom: 1pt; }
p { margin: 0 0 3pt; }
ul { margin: 0 0 4pt; padding-left: 14pt; }
li { margin: 0 0 2pt; }
section { break-inside: auto; }
</style></head><body>${body}</body></html>`;
}

/** Saves a blob under a file name through a temporary link. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Opens the print view in a new tab and starts the browser's print dialog,
 * where the user picks "Save as PDF". Returns false when a popup blocker
 * stopped the tab.
 */
export function printTailoredResume(doc: TailoredDoc, fileName: string): boolean {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return false;
  printWindow.document.open();
  printWindow.document.write(tailoredResumeHtml(doc, fileName.replace(/\.pdf$/, "")));
  printWindow.document.close();
  printWindow.focus();
  // Give the new document a moment to lay out before printing
  printWindow.setTimeout(() => printWindow.print(), 250);
  return true;
}
