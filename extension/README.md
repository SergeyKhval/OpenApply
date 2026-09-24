# OpenApply browser extension

Manifest V3 Chrome extension with a toolbar popup and two actions for the job posting in the current tab:

- **Save to OpenApply** opens `openapply.app/save?url=<posting>`. That page runs the same flow as the landing page's paste-a-link box: signed-in users land on the new application form, signed-out users on signup with the job waiting.
- **Check my resume match** opens `openapply.app/tools/resume-job-match#jd=<description>&url=<posting>`. The tool prefills the job description from the fragment, which browsers never send to a server.

Plain JavaScript, no build step. The extension never talks to Firebase and holds no auth.

## Permissions

`activeTab` + `scripting`, nothing else. When the user opens the popup, it runs `extractJob` (`src/extract.js`) once in that tab. `test/manifest.test.js` fails if anyone adds host permissions, content scripts or a background worker. Chrome Web Store review is faster without them.

## How the job is read

`src/extract.js`, first match wins:

1. Text the user selected (200+ characters)
2. Site selectors: LinkedIn, Indeed, Greenhouse, Lever, Ashby, Workable
3. schema.org `JobPosting` JSON-LD (most ATSs and many career sites)
4. The page's densest block of paragraphs and bullets, then `<main>`

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
