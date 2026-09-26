// Reads the job posting on the current page. The popup injects this with
// chrome.scripting.executeScript({ func: extractJob }) only after the user opens
// the popup, so Chrome serializes it on its own: keep every helper inside it.

/**
 * @typedef {Object} ExtractedJob
 * @property {string} url           location.href of the page
 * @property {string} title         job title, "" when not found
 * @property {string} company       company name, "" when not found
 * @property {string} location      where the job is ("Warsaw, Poland", "Remote"), "" when not found
 * @property {string} description   plain-text job description, "" when not found
 * @property {string} salary        formatted from schema.org baseSalary ("$120,000–$140,000/yr"), "" when not found
 * @property {"selection"|"site"|"json-ld"|"page"|"none"} source where the description came from
 * @property {Posting} posting      when the job was posted, {} when the page doesn't say
 */

/**
 * @typedef {Object} Posting
 * @property {string} [postedAt]            YYYY-MM-DD
 * @property {"json-ld"|"page"} [postedAtSource] schema.org datePosted, or the page's "2 weeks ago"
 * @property {true} [postedOrEarlier]       the page said "30+ days ago": posted on postedAt or before
 * @property {true} [reposted]              the page says "Reposted"
 * @property {string} [validThrough]        YYYY-MM-DD, schema.org validThrough
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

  function visibleText(element) {
    // Screen-reader-only suffixes like Indeed's " - job post"
    const copy = element.cloneNode(true);
    copy.querySelectorAll(".visually-hidden, .sr-only, .screen-reader-text").forEach((hidden) => hidden.remove());
    return clean(copy.textContent);
  }

  function firstText(selectors = []) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const text = element ? visibleText(element) : "";
      if (text) return text;
    }
    return "";
  }

  // A selector, or { all } to join every match: some boards split the
  // description into sections (requirements, benefits, about us)
  function firstBlock(selectors) {
    for (const selector of selectors) {
      const elements = typeof selector === "string"
        ? [document.querySelector(selector)].filter(Boolean)
        : [...document.querySelectorAll(selector.all)];
      const text = elements.map(blockText).filter(Boolean).join("\n\n");
      if (text.length >= MIN_DESCRIPTION_CHARS) return text;
    }
    return "";
  }

  // "Firma: ASTEK Polska", "Company: Acme"
  function withoutLabel(value) {
    return value.replace(/^(company|employer|firma|pracodawca|unternehmen|entreprise)\s*:\s*/i, "");
  }

  function placeName(place) {
    if (!place || typeof place !== "object") return "";
    const address = typeof place.address === "string" ? { streetAddress: place.address } : place.address || {};
    const country = typeof address.addressCountry === "object"
      ? address.addressCountry?.name
      : address.addressCountry;
    const parts = [address.addressLocality, address.addressRegion, country]
      .map(clean)
      .filter((part, index, all) => part && all.indexOf(part) === index);
    return parts.join(", ") || clean(place.name);
  }

  const CURRENCY_SYMBOLS = { USD: "$", EUR: "€", GBP: "£" };
  const UNIT_SUFFIX = { YEAR: "/yr", MONTH: "/mo", WEEK: "/wk", DAY: "/day", HOUR: "/hr" };

  // schema.org amounts are sometimes numbers, sometimes strings ("120000",
  // "120,000"), sometimes garbage ("competitive", "120k"); null for the latter
  function formatAmount(amount, currency) {
    const numeric = Number(typeof amount === "string" ? amount.replace(/,/g, "") : amount);
    if (!Number.isFinite(numeric)) return null;
    const number = Math.round(numeric).toLocaleString("en-US");
    return CURRENCY_SYMBOLS[currency] ? `${CURRENCY_SYMBOLS[currency]}${number}` : `${number} ${currency || ""}`.trim();
  }

  // schema.org JobPosting.baseSalary: a MonetaryAmount or MonetaryAmountDistribution
  function formatSalary(baseSalary) {
    if (!baseSalary || typeof baseSalary !== "object") return "";
    const amount = Array.isArray(baseSalary) ? baseSalary[0] : baseSalary;
    const currency = amount?.currency;
    const value = amount?.value;
    const { minValue, maxValue, value: single } = typeof value === "object" && value ? value : {};
    const unit = UNIT_SUFFIX[value?.unitText] || "";
    if (minValue != null && maxValue != null && minValue !== maxValue) {
      const min = formatAmount(minValue, currency);
      const max = formatAmount(maxValue, currency);
      return min && max ? `${min}–${max}${unit}` : "";
    }
    const amountValue = single ?? minValue ?? maxValue ?? (typeof value === "number" || typeof value === "string" ? value : undefined);
    if (amountValue == null) return "";
    const formatted = formatAmount(amountValue, currency);
    return formatted ? `${formatted}${unit}` : "";
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
    const places = (Array.isArray(job.jobLocation) ? job.jobLocation : [job.jobLocation])
      .map(placeName)
      .filter(Boolean);
    const remote = [job.jobLocationType].flat().includes("TELECOMMUTE") ? "Remote" : "";
    return {
      datePosted: job.datePosted,
      validThrough: job.validThrough,
      title: clean(job.title),
      company: clean(typeof organization === "string" ? organization : organization?.name),
      location: [...new Set([...places.slice(0, 3), remote])].filter(Boolean).join(" · "),
      description: typeof job.description === "string" ? htmlToText(job.description) : "",
      salary: formatSalary(job.baseSalary),
    };
  }

  const DAY_MS = 86400000;

  // "2026-09-22" or "2026-09-22T12:49:10.000Z" to "2026-09-22"; null unless a real day
  // this century, and not in the future when it's a posting date
  function isoDay(value, { future = false } = {}) {
    const day = typeof value === "string" ? value.trim().match(/^\d{4}-\d{2}-\d{2}/)?.[0] : null;
    const time = day ? Date.parse(`${day}T00:00:00Z`) : NaN;
    if (Number.isNaN(time) || new Date(time).toISOString().slice(0, 10) !== day) return null;
    if (time < Date.UTC(2000, 0, 1) || (!future && time > Date.now() + DAY_MS)) return null;
    return day;
  }

  // The job's own "posted" line. Only these elements: pages also list other
  // jobs with their own "3 days ago", which must not be read as this one's
  const POSTED_SELECTORS = [
    ".job-details-jobs-unified-top-card__tertiary-description-container",
    ".job-details-jobs-unified-top-card__primary-description-container",
    ".posted-time-ago__text",
    '[data-automation-id="postedOn"]',
  ];
  const UNIT_DAYS = { minute: 0, hour: 0, day: 1, week: 7, month: 30, year: 365 };

  // "Reposted 2 weeks ago", "1 day ago", "Posted 30+ Days Ago", "Posted Today"
  function postedOnPage() {
    for (const selector of POSTED_SELECTORS) {
      const element = document.querySelector(selector);
      if (!element) continue;
      const text = visibleText(element);
      const match = text.match(/(\d+)(\+?)\s*(minute|hour|day|week|month|year)s?\s+ago/i);
      const days = match
        ? Number(match[1]) * UNIT_DAYS[match[3].toLowerCase()]
        : /\b(today|just now)\b/i.test(text) ? 0 : /\byesterday\b/i.test(text) ? 1 : null;
      if (days === null) continue;
      return {
        postedAt: new Date(Date.now() - days * DAY_MS).toISOString().slice(0, 10),
        orEarlier: match?.[2] === "+",
        reposted: /\breposted\b/i.test(text),
      };
    }
    return null;
  }

  /** @returns {Posting} */
  function postingDates(structured) {
    const posting = {};
    const page = postedOnPage();
    const datePosted = isoDay(structured?.datePosted);
    if (datePosted) {
      posting.postedAt = datePosted;
      posting.postedAtSource = "json-ld";
    } else if (page) {
      posting.postedAt = page.postedAt;
      posting.postedAtSource = "page";
      if (page.orEarlier) posting.postedOrEarlier = true;
    }
    if (page?.reposted) posting.reposted = true;
    const validThrough = isoDay(structured?.validThrough, { future: true });
    if (validThrough) posting.validThrough = validThrough;
    return posting;
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
      location: [
        ".job-details-jobs-unified-top-card__primary-description-container .tvm__text",
        ".topcard__flavor--bullet",
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
      location: ['[data-testid="inlineHeader-companyLocation"]', '[data-testid="job-location"]'],
      description: ["#jobDescriptionText", ".jobsearch-jobDescriptionText"],
    },
    {
      host: /(^|\.)greenhouse\.io$/,
      title: [".job__title h1", "h1.app-title", ".app-title", "h1"],
      company: [".company-name"],
      location: [".job__location", ".location"],
      description: [".job__description", "#content"],
    },
    {
      host: /(^|\.)lever\.co$/,
      title: [".posting-headline h2", "h2"],
      company: [],
      location: [".posting-categories .location"],
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
      location: ['[data-ui="job-location"]'],
      // Description, requirements and benefits are separate sections
      description: [
        { all: '[data-ui="job-description"], [data-ui="job-requirements"], [data-ui="job-benefits"]' },
        '[data-ui="job-breakdown"]',
      ],
    },
    {
      // A single-page app: the server scraper only gets a bot challenge
      host: /(^|\.)theprotocol\.it$/,
      title: ['[data-test="text-offerTitle"]'],
      company: ['[data-test="text-offerEmployer"]'],
      location: ['[data-test="text-primaryLocation"]'],
      description: [{
        all: ['REQUIREMENTS', 'PROJECT', 'WORKSTYLE', 'PROGRESS_AND_BENEFITS', 'ABOUT_US']
          .map((section) => `[data-test="${section}"]`)
          .join(", "),
      }],
    },
  ];

  // Sentence-length text runs outside links: job descriptions are made of them,
  // while site chrome (menus, buttons, tags, job cards) is short labels or links
  function proseLength(root) {
    let total = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const length = clean(node.nodeValue).length;
      if (length < 30) continue;
      if (node.parentElement?.closest("nav, header, footer, aside, [role=navigation], script, style")) continue;
      // Links are navigation (job cards, company pages), not the job's own text
      if (node.parentElement?.closest("a")) continue;
      total += length;
    }
    return total;
  }

  // Whether text holds all of part and adds to it mostly after it: the sections
  // a site rule or JSON-LD missed (requirements, benefits), not a job list or
  // page header before it. Whitespace aside.
  function extendsText(text, part) {
    const whole = clean(text);
    const piece = clean(part);
    const start = whole.indexOf(piece.slice(0, 150));
    const end = whole.indexOf(piece.slice(-150), start);
    if (start < 0 || end < 0) return false;
    const before = start;
    const after = whole.length - (end + Math.min(150, piece.length));
    return before <= 200 && after > before;
  }

  const CONTROLS = "button, input, select, textarea, [role=button], [role=switch], [role=checkbox]";

  // Text outside links: "similar jobs" and "jobs at other companies" lists are
  // links, a job description is prose
  function unlinkedLength(element) {
    const linked = [...element.querySelectorAll("a")]
      .reduce((total, link) => total + clean(link.textContent).length, 0);
    return Math.max(0, clean(element.textContent).length - linked);
  }

  // Any page: the element holding the most paragraph and bullet text, widened
  // to its parent while that adds headings or more prose (boards that split
  // the description into sections), not site chrome
  function densestTextBlock() {
    const scores = new Map();
    document.querySelectorAll("p, li").forEach((element) => {
      if (element.closest("nav, header, footer, aside, [role=navigation]")) return;
      const container = element.tagName === "LI"
        ? element.parentElement?.parentElement
        : element.parentElement;
      if (!container) return;
      scores.set(container, (scores.get(container) || 0) + unlinkedLength(element));
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
    let prose = proseLength(best);
    for (let step = 0; step < 6; step++) {
      const parent = best.parentElement;
      if (!parent || parent === document.body) break;
      const addsChrome = [...parent.querySelectorAll("nav, header, footer, aside")]
        .some((element) => !best.contains(element));
      if (addsChrome) break;
      const parentText = blockText(parent);
      const parentProse = proseLength(parent);
      const addedMostlyProse = parentProse - prose >= (parentText.length - text.length) * 0.5;
      // Apply, Save and Follow buttons, alert switches: a step that brings them
      // in without much prose is the page around the job, not more of its text
      const addsControls = [...parent.querySelectorAll(CONTROLS)]
        .some((element) => !best.contains(element));
      if ((addsControls || parentText.length > text.length * 1.6) && !addedMostlyProse) break;
      best = parent;
      text = parentText;
      prose = parentProse;
    }
    return text;
  }

  const OUTSIDE_CONTENT = "nav, header, footer, aside, [role=navigation], [role=banner], [role=contentinfo]";

  // Generic pages: the first short text in the page content matching a selector.
  // Searches <main> first so "similar jobs" lists after it can't win.
  function contentText(selectors, maxLength) {
    const roots = [document.querySelector("main, [role=main]"), document.body].filter(Boolean);
    for (const root of roots) {
      for (const element of root.querySelectorAll(selectors)) {
        if (element.closest(OUTSIDE_CONTENT)) continue;
        const text = withoutLabel(visibleText(element)).replace(/^(location|lokalizacja|standort|lieu)\s*:\s*/i, "");
        if (text.length >= 2 && text.length <= maxLength) return text;
      }
    }
    return "";
  }

  const pageTitle = clean(document.title);
  const ogTitle = clean(document.querySelector('meta[property="og:title"]')?.getAttribute("content"));
  const siteName = clean(document.querySelector('meta[property="og:site_name"]')?.getAttribute("content"));
  const hostWord = location.hostname.replace(/^www\./, "");
  // "linkedin" for www.linkedin.com, "theprotocol" for theprotocol.it
  const hostName = hostWord.split(".").slice(-2, -1)[0] || hostWord;

  // "Account Manager - Careers at Airbnb", "Frontend Engineer | theprotocol.it"
  function withoutSiteSuffix(text) {
    let value = text;
    for (let step = 0; step < 3; step++) {
      const next = value.replace(/ [|\-–—] ([^|\-–—]+)$/, (whole, tail) => {
        const suffix = tail.trim().toLowerCase();
        const isSite = /\b(careers?|jobs?|praca|stellenangebote|emplois?)\b/.test(suffix)
          || suffix === siteName.toLowerCase()
          || suffix === hostWord.toLowerCase()
          || suffix === hostName.toLowerCase();
        return isSite ? "" : whole;
      });
      if (next === value) break;
      value = next;
    }
    return value.trim();
  }

  // "Engineering Manager | EduGO": pages without an <h1> still show the role on
  // its own, so the tab title's first part is the title when the page has an
  // element with exactly that text
  function titleOnPage(tabTitle) {
    const first = tabTitle.split(/ [|\-–—] | at | @ /)[0].trim();
    if (!first || first === tabTitle || first.length > 150) return "";
    const root = document.querySelector("main, [role=main]") || document.body;
    for (const element of root.querySelectorAll("h1, h2, h3, p, span, div")) {
      if (element.closest(OUTSIDE_CONTENT) || element.children.length > 1) continue;
      if (clean(element.textContent) === first) return first;
    }
    return "";
  }

  // "Job Application for AI Engineer at GitLab", "Engineer (K/M), ASTEK Polska - Praca w IT"
  function companyAfterTitle(title) {
    if (!title) return "";
    for (const text of [ogTitle, pageTitle]) {
      const index = text.indexOf(title);
      if (index < 0) continue;
      const rest = text.slice(index + title.length);
      const match = rest.match(/^\s*(?:,| at | @ | [|\-–—] )\s*([^,|\-–—]+)/i);
      const company = match ? match[1].trim() : "";
      if (company && company.toLowerCase() !== siteName.toLowerCase() && !company.includes(hostWord)) {
        return company.replace(/^(careers|jobs) (at|@) /i, "");
      }
    }
    return "";
  }

  // "Łódź, Łódzkie, Poland · 1 month ago · 18 people clicked apply": the first
  // part of a job's details line, when it reads as a place
  const PLACE = /^\p{Lu}[\p{L}.'’ -]*(, \p{Lu}[\p{L}.'’ -]*){1,3}( \((remote|hybrid|on-site)\))?$/u;
  const WORK_MODE = /^(remote|hybrid|on-site)\b|\((remote|hybrid|on-site)\)$/i;
  function locationInDetailsLine() {
    const root = document.querySelector("main, [role=main]");
    if (!root) return "";
    for (const element of root.querySelectorAll("p, div, span, li")) {
      if (element.closest(OUTSIDE_CONTENT)) continue;
      const text = clean(element.textContent);
      if (text.length > 160 || !/ [·•] /.test(text)) continue;
      // The line itself, not a wrapper that runs it into the title and company
      if ([...element.children].some((child) => / [·•] /.test(clean(child.textContent)))) continue;
      const first = text.split(/ [·•] /)[0].trim();
      if (first.length <= 80 && (PLACE.test(first) || WORK_MODE.test(first))) return first;
    }
    return "";
  }

  const url = location.href;
  const host = location.hostname;
  const result = { url, title: "", company: "", location: "", description: "", source: "none", posting: {}, salary: "" };

  const site = SITES.find((candidate) => candidate.host.test(host));
  if (site) {
    result.title = firstText(site.title);
    result.company = withoutLabel(firstText(site.company));
    result.location = firstText(site.location);
    result.description = firstBlock(site.description);
    if (result.description) result.source = "site";
  }

  const structured = jsonLdJob();
  result.posting = postingDates(structured);
  if (structured) {
    result.title = result.title || structured.title;
    result.company = result.company || structured.company;
    result.location = result.location || structured.location;
    result.salary = result.salary || structured.salary;
    if (!result.description && structured.description.length >= MIN_DESCRIPTION_CHARS) {
      result.description = structured.description;
      result.source = "json-ld";
    }
  }

  if (!result.title) {
    // The page heading, when the tab title confirms it's the job and not the site name
    const heading = [...document.querySelectorAll("h1")]
      .filter((element) => !element.closest(OUTSIDE_CONTENT))
      .map(visibleText)
      .find((text) => text.length >= 3 && text.length <= 150);
    const confirmed = heading && (pageTitle.includes(heading) || ogTitle.includes(heading));
    result.title = confirmed
      ? heading
      : titleOnPage(withoutSiteSuffix(ogTitle || pageTitle)) || withoutSiteSuffix(ogTitle || pageTitle) || heading || "";
  }
  if (!result.company) {
    result.company = companyAfterTitle(result.title)
      || contentText('[itemprop="hiringOrganization"], [data-testid*="company" i], [data-test*="employer" i], [data-test*="company" i], [class*="company-name" i], [class*="companyName"]', 80)
      || siteName.replace(/^(careers|jobs) (at|@) /i, "");
  }
  if (!result.location) {
    result.location = locationInDetailsLine() || contentText('[itemprop="jobLocation"], [data-testid*="location" i], [data-test*="location" i], [data-ui*="location" i], [class*="job-location" i], [class*="jobLocation"], [class*="location" i]', 80);
  }

  // Site rules and JSON-LD can miss sections (requirements in a block of their
  // own, a JSON-LD summary of the posting). The page's own block wins when it
  // holds the same text and clearly more.
  const pageBlock = densestTextBlock();
  if (result.description
    && pageBlock.length >= result.description.length * 1.3
    && extendsText(pageBlock, result.description)) {
    result.description = pageBlock;
    result.source = "page";
  }

  if (!result.description) {
    const main = document.querySelector("main, [role=main], article");
    const candidates = [pageBlock, main ? blockText(main) : ""];
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
