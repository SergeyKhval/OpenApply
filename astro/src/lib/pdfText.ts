// Extracts text from a PDF in the browser, in reading order, the way a
// simple resume parser would. The file never leaves the device.
export async function extractPdfText(file: File): Promise<string> {
  const [pdfjs, { default: workerUrl }] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
  const pages: string[] = [];

  try {
    const pdf = await loadingTask.promise;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      let pageText = "";
      for (const textItem of content.items) {
        if (!("str" in textItem)) continue;
        pageText += textItem.str;
        pageText += textItem.hasEOL ? "\n" : " ";
      }
      pages.push(pageText.replace(/[ \t]+\n/g, "\n").replace(/ {2,}/g, " ").trim());
    }
  } finally {
    await loadingTask.destroy();
  }

  return pages.join("\n\n").trim();
}
