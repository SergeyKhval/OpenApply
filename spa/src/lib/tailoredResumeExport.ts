// Downloads of a tailored or built resume: a DOCX built in the browser (docx, loaded
// only on click) and a print view for "Save as PDF". Both follow the same
// ATS-friendly layout: one column, plain section headings, real bullets, no
// tables, columns, icons, headers or footers.
import type { ResumeDoc } from "@/lib/tailoredResume";

export type ExportMeta = {
  companyName?: string | null;
  position?: string | null;
};

/** The candidate's name: the first line of the top block. */
export function candidateName(doc: ResumeDoc): string {
  const top = doc.sections.find((section) => section.heading === null);
  return top?.lines[0]?.text.trim() ?? "";
}

/** "Sarah Chen - Globex Senior Frontend Engineer", safe as a file name. */
export function exportFileName(doc: ResumeDoc, meta: ExportMeta, extension: "docx" | "pdf"): string {
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

// Two ATS-safe looks for built resumes; tailored versions always use classic.
// Only fonts and spacing differ: same single column, real bullets, no tables.
export type ExportTemplate = "classic" | "compact";

type DocxStyle = {
  font: string;
  // Sizes in half-points
  nameSize: number;
  headingSize: number;
  bodySize: number;
  smallCapsHeadings: boolean;
  headingSpacing: { before: number; after: number };
  lineAfter: number;
  bulletAfter: number;
  margin: { top: number; bottom: number; left: number; right: number };
};

const DOCX_STYLES: Record<ExportTemplate, DocxStyle> = {
  // 16pt name, 12pt uppercase headings, 10.5pt Calibri body
  classic: {
    font: "Calibri",
    nameSize: 32,
    headingSize: 24,
    bodySize: 21,
    smallCapsHeadings: false,
    headingSpacing: { before: 240, after: 80 },
    lineAfter: 60,
    bulletAfter: 40,
    margin: { top: 720, bottom: 720, left: 900, right: 900 },
  },
  // 15pt name, 11pt small-caps headings, 10pt Cambria body, tighter, so a
  // ten-year career fits on a page
  compact: {
    font: "Cambria",
    nameSize: 30,
    headingSize: 22,
    bodySize: 20,
    smallCapsHeadings: true,
    headingSpacing: { before: 160, after: 60 },
    lineAfter: 30,
    bulletAfter: 20,
    margin: { top: 600, bottom: 600, left: 720, right: 720 },
  },
};

export async function tailoredResumeDocx(doc: ResumeDoc, template: ExportTemplate = "classic"): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, BorderStyle } = await import("docx");
  const style = DOCX_STYLES[template];
  const paragraphs: InstanceType<typeof Paragraph>[] = [];

  doc.sections.forEach((section, sectionIndex) => {
    if (section.heading) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: style.smallCapsHeadings ? section.heading : section.heading.toUpperCase(),
              bold: true,
              size: style.headingSize,
              font: style.font,
              ...(style.smallCapsHeadings ? { smallCaps: true } : {}),
            }),
          ],
          spacing: style.headingSpacing,
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "999999", space: 2 } },
        }),
      );
    }
    section.lines.forEach((line, lineIndex) => {
      const isName = section.heading === null && sectionIndex === 0 && lineIndex === 0;
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: line.text, bold: isName || line.strong === true, size: isName ? style.nameSize : style.bodySize, font: style.font }),
          ],
          ...(line.bullet ? { bullet: { level: 0 } } : {}),
          spacing: { after: line.bullet ? style.bulletAfter : style.lineAfter },
        }),
      );
    });
  });

  const document = new Document({
    creator: "OpenApply",
    styles: { default: { document: { run: { font: style.font, size: style.bodySize } } } },
    sections: [{ properties: { page: { margin: style.margin } }, children: paragraphs }],
  });
  return Packer.toBlob(document);
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

const PRINT_CSS: Record<ExportTemplate, string> = {
  classic: `@page { margin: 14mm 16mm; }
body { font-family: Calibri, Carlito, "Segoe UI", Arial, sans-serif; font-size: 10.5pt; line-height: 1.35; color: #000; margin: 0; }
h1 { font-size: 16pt; margin: 0 0 2pt; }
h2 { font-size: 12pt; text-transform: uppercase; border-bottom: 0.5pt solid #999; margin: 12pt 0 4pt; padding-bottom: 1pt; }
p { margin: 0 0 3pt; }
ul { margin: 0 0 4pt; padding-left: 14pt; }
li { margin: 0 0 2pt; }`,
  compact: `@page { margin: 10.5mm 12.7mm; }
body { font-family: Cambria, Georgia, "Times New Roman", serif; font-size: 10pt; line-height: 1.28; color: #000; margin: 0; }
h1 { font-size: 15pt; margin: 0 0 1pt; }
h2 { font-size: 11pt; font-variant: small-caps; letter-spacing: 0.02em; border-bottom: 0.5pt solid #999; margin: 8pt 0 3pt; padding-bottom: 1pt; }
p { margin: 0 0 1.5pt; }
ul { margin: 0 0 3pt; padding-left: 13pt; }
li { margin: 0 0 1pt; }`,
};

/** A standalone page for the browser's "Save as PDF". */
export function tailoredResumeHtml(doc: ResumeDoc, title: string, template: ExportTemplate = "classic"): string {
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
        items.push(
          isName
            ? `<h1>${escapeHtml(line.text)}</h1>`
            : line.strong
              ? `<p><strong>${escapeHtml(line.text)}</strong></p>`
              : `<p>${escapeHtml(line.text)}</p>`,
        );
      });
      flush();
      return `<section>${heading}${items.join("")}</section>`;
    })
    .join("");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
${PRINT_CSS[template]}
section { break-inside: auto; }
@media screen { body { padding: 14mm 16mm; } }
@media screen and (max-width: 480px) { body { padding: 16px; } }
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
export function printTailoredResume(doc: ResumeDoc, fileName: string, template: ExportTemplate = "classic"): boolean {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return false;
  printWindow.document.open();
  printWindow.document.write(tailoredResumeHtml(doc, fileName.replace(/\.pdf$/, ""), template));
  printWindow.document.close();
  printWindow.focus();
  // Give the new document a moment to lay out before printing
  printWindow.setTimeout(() => printWindow.print(), 250);
  return true;
}
