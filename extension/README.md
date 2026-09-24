# OpenApply browser extension

Manifest V3 Chrome extension with a toolbar popup and two actions for the job posting in the current tab:

- **Save to OpenApply** shows the title, company and location it read as editable fields, then opens `openapply.app/save#job=<payload>`: the job (url, title, company, location, description) as base64url of zlib-deflated JSON, in the fragment so it never reaches a server. `/save` hands it to the app as a pending application (`shared/extensionJob.ts` decodes it): signed-in users land on the new application, signed-out users on signup with the job waiting. No server scrape, so single-page apps and login-gated pages work. When the popup finds no description, Save falls back to `openapply.app/save?url=<posting>`, the landing page's server-side link parser.
- **Check my resume match** opens `openapply.app/tools/resume-job-match#jd=<description>&url=<posting>`. The tool prefills the job description from the fragment, which browsers never send to a server.

Plain JavaScript, no build step. The extension never talks to Firebase and holds no auth.

## Permissions

`activeTab` + `scripting`, nothing else. When the user opens the popup, it runs `extractJob` (`src/extract.js`) once in that tab. `test/manifest.test.js` fails if anyone adds host permissions, content scripts or a background worker. Chrome Web Store review is faster without them.

## How the job is read

`src/extract.js`, first match wins:

1. Text the user selected (200+ characters)
2. Site selectors: LinkedIn, Indeed, Greenhouse, Lever, Ashby, Workable, theprotocol.it
3. schema.org `JobPosting` JSON-LD (most ATSs and many career sites)
4. The page's densest block of paragraphs and bullets, widened over sibling sections of prose, then `<main>`

Title, company and location follow the same order. On pages without rules or JSON-LD, the title is the page's `<h1>` when the tab title confirms it, the company comes from the tab title ("Role at Company", "Role, Company") or company-named elements, and the location from location-named elements.

`src/links.js` turns search-page URLs into posting URLs (LinkedIn `currentJobId`, Indeed `vjk`) and strips tracking params before saving.

## Develop

```bash
pnpm --filter openapply-extension test   # vitest + jsdom, against saved pages in test/fixtures
pnpm build:extension                     # (repo root) writes extension/dist/openapply-extension-<version>.zip
```

Load it unpacked: `chrome://extensions`, enable Developer mode, **Load unpacked**, pick this `extension/` folder.

Fixtures in `test/fixtures/` are real pages captured on 2026-09-24 (scripts and styles stripped). The `*-synthetic.html` ones are layouts a headless browser can't capture (signed-in LinkedIn, Indeed), built from their selectors. When a site changes its markup, capture the page again and update the expectations.

## Release

1. Bump `version` in `manifest.json`.
2. `pnpm build:extension`
3. Upload the zip in the Chrome Web Store developer dashboard. Listing text, screenshots and privacy answers are in `store/listing.md`.

`store/source/icon.svg` is the icon source; the PNGs in `icons/` are renders of it.
