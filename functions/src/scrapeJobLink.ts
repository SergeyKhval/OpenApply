import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import puppeteer, { type Browser } from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { load } from "cheerio";

const db = getFirestore();

export const scrapeJobLink = onDocumentCreated(
  { memory: "1GiB", document: "jobs/{docId}" },
  async (event) => {
    const snapshot = event.data;
    let browser: Browser | null = null;

    if (!snapshot) {
      console.log("No data in snapshot");
      return;
    }

    const data = snapshot.data();
    const url = data.jobDescriptionLink;

    // Helper function to update document with error
    const setFailedStatus = async (error: unknown) => {
      let errorMessage = "Unknown error occurred";

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      } else if (error && typeof error === "object" && "message" in error) {
        errorMessage = String(error.message);
      }

      console.error(`Error scraping ${url}:`, error);

      try {
        await db.collection("jobs").doc(snapshot.id).update({
          status: "failed",
          errorMessage,
          updatedAt: FieldValue.serverTimestamp(),
        });
      } catch (updateError) {
        console.error(
          "Failed to update document with error status:",
          updateError,
        );
      }
    };

    try {
      // Validate URL
      if (!url || typeof url !== "string") {
        await setFailedStatus("Invalid or missing URL");
        return;
      }

      // Launch browser with error handling
      try {
        browser = await puppeteer.launch({
          headless: true,
          // all these flags intend to reduce chrome memory consumption
          // so we can run it on a 256MB RAM GCF instance
          args: [
            ...chromium.args,
            "--disable-dev-shm-usage",
            "--disable-background-networking",
            "--disable-background-timer-throttling",
            "--disable-backgrounding-occluded-windows",
            "--disable-breakpad",
            "--disable-client-side-phishing-detection",
            "--disable-component-update",
            "--disable-default-apps",
            "--disable-dev-tools",
            "--disable-extensions",
            "--disable-features=TranslateUI,BlinkGenPropertyTrees",
            "--disable-hang-monitor",
            "--disable-ipc-flooding-protection",
            "--disable-popup-blocking",
            "--disable-prompt-on-repost",
            "--disable-renderer-backgrounding",
            "--disable-sync",
            "--metrics-recording-only",
            "--mute-audio",
            "--no-first-run",
            "--no-default-browser-check",
            "--no-service-autorun",
            "--password-store=basic",
            "--use-mock-keychain",
            "--single-process",
            "--no-sandbox", // Required in GCF
            "--disable-setuid-sandbox",
          ],
          executablePath: await chromium.executablePath(),
        });
      } catch (launchError) {
        await setFailedStatus(`Failed to launch browser: ${launchError}`);
        return;
      }

      const page = await browser.newPage();

      // Set up request interception with error handling
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        if (
          ["image", "stylesheet", "font", "media"].includes(req.resourceType())
        ) {
          req.abort();
        } else {
          req.continue();
        }
      });

      // Navigate to page with timeout and error handling
      try {
        await page.goto(url, { waitUntil: "networkidle2", timeout: 15000 });
      } catch (navigationError) {
        if (navigationError instanceof Error) {
          if (navigationError.name === "TimeoutError") {
            await setFailedStatus(`Page load timeout (15s) for URL: ${url}`);
          } else {
            await setFailedStatus(
              `Failed to navigate to URL: ${navigationError.message}`,
            );
          }
        } else {
          await setFailedStatus(
            `Failed to navigate to URL: ${navigationError}`,
          );
        }
        return;
      }

      // Extract content with error handling
      let content: string | null = null;
      try {
        content = await page.content();

        if (!content || content.trim().length === 0) {
          await setFailedStatus("No content extracted from page");
          return;
        }

        // Clean up content: remove tags that do not directly contain text content
        const $ = load(content);
        $(
          "svg, script, style, img, noscript, iframe, canvas, video, audio, picture, source, track, object, embed, link, form, fieldset, input, button, select, textarea, label, option, optgroup, legend, datalist, output, meter, progress",
        ).remove();
        // Remove elements that do not contain any visible text
        $(
          "[class], div, span, section, header, footer, aside, nav, main, article",
        ).each(function () {
          const el = $(this);
          // Remove if element has no text (ignoring whitespace) and no <a>, <p>, <li>, <h1>-<h6>, <table>, <tr>, <td>, <th>, <ul>, <ol>
          if (
            el.text().trim() === "" &&
            el.find(
              "a, p, li, h1, h2, h3, h4, h5, h6, table, tr, td, th, ul, ol",
            ).length === 0
          ) {
            el.remove();
          }
        });

        // Remove all attributes from all remaining elements
        $("body *").each(function () {
          const el = $(this);
          const attributes = el.get(0)?.attribs;
          if (attributes) {
            Object.keys(attributes).forEach(attr => {
              el.removeAttr(attr);
            });
          }
        });

        // Flatten structure: remove containers that only wrap other elements without adding semantic value
        let changed = true;
        while (changed) {
          changed = false;

          // Target elements that are typically used as containers
          $("div, span, section, article, main, aside").each(function () {
            const el = $(this);
            const children = el.children();

            // Check if this element has no direct text content (only whitespace)
            const hasDirectText = el.contents().toArray().some(node =>
              node.type === 'text' && node.data.trim().length > 0
            );

            // If no direct text and has children, unwrap it (move children up one level)
            if (!hasDirectText && children.length > 0) {
              // Check if we're breaking semantic structure
              const tagName = el.get(0)?.tagName?.toLowerCase();
              const parentTag = el.parent().get(0)?.tagName?.toLowerCase();

              // Preserve semantic structures
              const isSemanticStructure = (
                (parentTag === 'ul' || parentTag === 'ol') && (tagName === 'li') ||
                (parentTag === 'table') && (tagName === 'tr' || tagName === 'tbody' || tagName === 'thead' || tagName === 'tfoot') ||
                (parentTag === 'tr') && (tagName === 'td' || tagName === 'th') ||
                (parentTag === 'dl') && (tagName === 'dt' || tagName === 'dd') ||
                (parentTag === 'select') && (tagName === 'option' || tagName === 'optgroup') ||
                (parentTag === 'fieldset') && (tagName === 'legend')
              );

              if (!isSemanticStructure) {
                // Move all children before this element
                children.each(function() {
                  $(this).insertBefore(el);
                });
                // Remove the now-empty container
                el.remove();
                changed = true;
              }
            }
          });
        }

        content = $.html();
      } catch (extractError) {
        await setFailedStatus(
          `Failed to extract page content: ${extractError}`,
        );
        return;
      }

      // Update document with success status
      try {
        await db.collection("jobs").doc(snapshot.id).update({
          status: "scrapped",
          content,
          updatedAt: FieldValue.serverTimestamp(),
        });
      } catch (updateError) {
        await setFailedStatus(
          `Failed to update document with content: ${updateError}`,
        );
        return;
      }
    } catch (error) {
      // Catch-all for any unexpected errors
      await setFailedStatus(error);
    } finally {
      // Always close browser if it was opened
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.error("Failed to close browser:", closeError);
        }
      }
    }
  },
);
