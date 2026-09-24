// Reads the job posting on the current page. The popup injects this with
// chrome.scripting.executeScript({ func: extractJob }) only after the user opens
// the popup, so Chrome serializes it on its own: keep every helper inside it.

/**
 * @typedef {Object} ExtractedJob
 * @property {string} url           location.href of the page
 * @property {string} title         job title, "" when not found
 * @property {string} company       company name, "" when not found
 * @property {string} description   plain-text job description, "" when not found
 * @property {"selection"|"site"|"json-ld"|"page"|"none"} source where the description came from
 */

/** @returns {ExtractedJob} */
export function extractJob() {
  const MAX_CHARS = 15000;
  const MIN_DESCRIPTION_CHARS = 200;
  // Paragraph-level blocks get a blank line around them, line-level ones a line break
  const PARAGRAPH_TAGS = new Set([
    "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DL", "FIGCAPTION", "FOOTER", "H1", "H2", "H3",
    "H4", "H5", "H6", "HEADER", "HR", "MAIN", "OL", "P", "PRE", "SECTION", "TABLE", "UL",
  ]);
  const LINE_TAGS = new Set(["BR", "DD", "DIV", "DT", "LI", "TR"]);
  const PARAGRAPH_BREAK = "\u0002";
  const LINE_BREAK = "\u0001";
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "SVG", "BUTTON", "IFRAME"]);

  // Text with line breaks between blocks. innerText would do this, but only for
  // rendered nodes, and JSON-LD descriptions arrive as detached HTML strings.
  function blockText(root) {
    const parts = [];
    function walk(node) {
      if (node.nodeType === 3) {
        parts.push(node.nodeValue.replace(/\s+/g, " "));
        return;
      }
      if (node.nodeType !== 1 || SKIP_TAGS.has(node.tagName)) return;
      if (node.hidden || node.getAttribute("aria-hidden") === "true") return;
      const breakAround = PARAGRAPH_TAGS.has(node.tagName)
        ? PARAGRAPH_BREAK
        : LINE_TAGS.has(node.tagName) ? LINE_BREAK : "";
      parts.push(breakAround);
      if (node.tagName === "LI") parts.push("- ");
      node.childNodes.forEach(walk);
      parts.push(breakAround);
    }
    walk(root);
    // A run of breaks becomes one: a blank line if any block in it was a paragraph
    return parts
      .join("")
      .replace(/[\s\u0001\u0002]*[\u0001\u0002][\s\u0001\u0002]*/g, (run) =>
        run.includes(PARAGRAPH_BREAK) ? "\n\n" : "\n")
      .split("\n")
      .map((line) => line.trim())
      .join("\n")
      .trim();
  }

  function htmlToText(html) {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
    return blockText(doc.body);
  }

  function clean(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function firstText(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (!element) continue;
      // Screen-reader-only suffixes like Indeed's " - job post"
      const copy = element.cloneNode(true);
      copy.querySelectorAll(".visually-hidden, .sr-only, .screen-reader-text").forEach((hidden) => hidden.remove());
      const text = clean(copy.textContent);
      if (text) return text;
    }
    return "";
  }

  function firstBlock(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const text = element ? blockText(element) : "";
      if (text.length >= MIN_DESCRIPTION_CHARS) return text;
    }
    return "";
  }

  // schema.org JobPosting: Greenhouse, Lever, Ashby, Workable and many career sites publish it
  function jsonLdJob() {
    const candidates = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
      try {
        const data = JSON.parse(script.textContent || "");
        const queue = Array.isArray(data) ? [...data] : [data];
        while (queue.length) {
          const item = queue.shift();
          if (!item || typeof item !== "object") continue;
          if (Array.isArray(item["@graph"])) queue.push(...item["@graph"]);
          const type = item["@type"];
          if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) {
            candidates.push(item);
          }
        }
      } catch {
        // Malformed JSON-LD is common; skip it
      }
    });
    const job = candidates[0];
    if (!job) return null;
    const organization = Array.isArray(job.hiringOrganization)
      ? job.hiringOrganization[0]
      : job.hiringOrganization;
    return {
      title: clean(job.title),
      company: clean(typeof organization === "string" ? organization : organization?.name),
      description: typeof job.description === "string" ? htmlToText(job.description) : "",
    };
  }

  // Site-specific selectors for the boards that don't ship JSON-LD to logged-in users
  const SITES = [
    {
      host: /(^|\.)linkedin\.com$/,
      title: [
        ".job-details-jobs-unified-top-card__job-title h1",
        ".job-details-jobs-unified-top-card__job-title",
        ".jobs-unified-top-card__job-title",
        ".top-card-layout__title",
        "h1",
      ],
      company: [
        ".job-details-jobs-unified-top-card__company-name a",
        ".job-details-jobs-unified-top-card__company-name",
        ".jobs-unified-top-card__company-name",
        ".topcard__org-name-link",
        ".topcard__flavor",
      ],
      description: [
        "#job-details",
        ".jobs-description__content",
        ".jobs-description-content__text",
        ".show-more-less-html__markup",
        ".description__text",
      ],
    },
    {
      host: /(^|\.)indeed\.[a-z.]+$/,
      title: [
        '[data-testid="jobsearch-JobInfoHeader-title"]',
        ".jobsearch-JobInfoHeader-title",
        "h1",
      ],
      company: [
        '[data-testid="inlineHeader-companyName"]',
        '[data-company-name="true"]',
        ".jobsearch-CompanyInfoContainer a",
      ],
      description: ["#jobDescriptionText", ".jobsearch-jobDescriptionText"],
    },
    {
      host: /(^|\.)greenhouse\.io$/,
      title: [".job__title h1", "h1.app-title", ".app-title", "h1"],
      company: [".company-name"],
      description: [".job__description", "#content"],
    },
    {
      host: /(^|\.)lever\.co$/,
      title: [".posting-headline h2", "h2"],
      company: [],
      description: [
        ".posting-page .section-wrapper.page-full-width:not(.accent-section)",
        '[data-qa="job-description"]',
      ],
    },
    {
      host: /(^|\.)ashbyhq\.com$/,
      title: ['[class*="_title_"]', "h1"],
      company: [],
      description: ['[class*="_descriptionText_"]', "#overview", '[class*="_description_"]'],
    },
    {
      host: /(^|\.)workable\.com$/,
      title: ['[data-ui="job-title"]', "h1"],
      company: [],
      description: ['[data-ui="job-description"]', '[data-ui="job-breakdown"]'],
    },
  ];

  // Career sites without markup we know: the element holding the most paragraph
  // and bullet text, widened to its parent while that only adds headings, not site chrome
  function densestTextBlock() {
    const scores = new Map();
    document.querySelectorAll("p, li").forEach((element) => {
      if (element.closest("nav, header, footer, aside, [role=navigation]")) return;
      const container = element.tagName === "LI"
        ? element.parentElement?.parentElement
        : element.parentElement;
      if (!container) return;
      scores.set(container, (scores.get(container) || 0) + clean(element.textContent).length);
    });
    let best = null;
    let bestScore = 0;
    scores.forEach((score, container) => {
      if (score > bestScore) {
        best = container;
        bestScore = score;
      }
    });
    if (!best) return "";
    let text = blockText(best);
    for (let step = 0; step < 3; step++) {
      const parent = best.parentElement;
      if (!parent || parent === document.body) break;
      const addsChrome = [...parent.querySelectorAll("nav, header, footer, aside")]
        .some((element) => !best.contains(element));
      if (addsChrome) break;
      const parentText = blockText(parent);
      if (parentText.length > text.length * 1.6) break;
      best = parent;
      text = parentText;
    }
    return text;
  }

  const url = location.href;
  const host = location.hostname;
  const result = { url, title: "", company: "", description: "", source: "none" };

  const site = SITES.find((candidate) => candidate.host.test(host));
  if (site) {
    result.title = firstText(site.title);
    result.company = firstText(site.company);
    result.description = firstBlock(site.description);
    if (result.description) result.source = "site";
  }

  const structured = jsonLdJob();
  if (structured) {
    result.title = result.title || structured.title;
    result.company = result.company || structured.company;
    if (!result.description && structured.description.length >= MIN_DESCRIPTION_CHARS) {
      result.description = structured.description;
      result.source = "json-ld";
    }
  }

  if (!result.title) {
    // Page titles often end in " - Careers at Airbnb" or " | Jobs"
    result.title = (
      clean(document.querySelector('meta[property="og:title"]')?.getAttribute("content"))
      || clean(document.title)
    ).replace(/ [|\-–] (careers|jobs)\b.*$/i, "");
  }
  if (!result.company) {
    // "Job Application for AI Engineer at GitLab"
    const pageTitle = clean(document.title);
    const marker = result.title ? `${result.title} at ` : "";
    const index = marker ? pageTitle.indexOf(marker) : -1;
    result.company = index >= 0
      ? pageTitle.slice(index + marker.length).split(/ [|\-–] /)[0].trim()
      : clean(document.querySelector('meta[property="og:site_name"]')?.getAttribute("content"))
        .replace(/^(careers|jobs) (at|@) /i, "");
  }

  if (!result.description) {
    const main = document.querySelector("main, [role=main], article");
    const candidates = [densestTextBlock(), main ? blockText(main) : ""];
    const text = candidates.find((candidate) => candidate.length >= MIN_DESCRIPTION_CHARS);
    if (text) {
      result.description = text;
      result.source = "page";
    }
  }

  // Text the user highlighted beats any guess
  const selection = clean(window.getSelection()?.toString()).length >= MIN_DESCRIPTION_CHARS
    ? window.getSelection().toString().trim()
    : "";
  if (selection) {
    result.description = selection;
    result.source = "selection";
  }

  result.description = result.description.slice(0, MAX_CHARS);
  return result;
}
