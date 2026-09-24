# Chrome Web Store listing kit

Everything the Chrome Web Store developer dashboard asks for, ready to paste.
Upload file: `pnpm build:extension` (repo root) writes `extension/dist/openapply-extension-<version>.zip`.

Refreshed 2026-09-24 for extension 1.1.1 (in-page extraction, editable popup fields, instant save with no server scrape). The previous listing and screenshots described the 1.0 flow (server-side link parsing, no editable fields) and are now stale.

## Submission checklist (for Sergey)

0. Before submitting: try Save and Check match once on a job you're signed in to on LinkedIn and on Indeed (never verified live, only on captured fixtures). The summary names both sites; if either fails, change the summary to "Works on Greenhouse, Lever, Ashby and more" (also `description` in extension/manifest.json).
1. Build the zip: `export ASDF_NODEJS_VERSION=22.22.2 && pnpm build:extension` (repo root). Confirms `extension/dist/openapply-extension-1.1.1.zip`.
2. Go to the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole), pay the one-time $5 registration fee if you haven't, then "New item" and upload the zip.
3. **Store listing tab**: paste the Name, Summary and Description below. Category: Productivity. Language: English.
4. **Graphics**: upload `icon-128.png`, the 5 files in `screenshots/`, and `promo-small-440x280.png` in that order (Chrome shows screenshots in upload order).
5. **Privacy tab**: paste the Single purpose text, add the two Permission justifications (`activeTab`, `scripting`), answer "No" to remote code, tick only the one Data usage box listed below, and check all three certification boxes.
6. Privacy policy URL: `https://openapply.app/privacy#browser-extension`. Confirm that section is live (it is, as of this branch).
7. **Distribution tab**: Visibility Public, all regions.
8. Submit for review. First review is typically 1-3 business days; MV3 extensions with only `activeTab`/`scripting` and no host permissions usually clear the fast lane.
9. After it's live: update `astro/README.md` / the extension's own README with the real Chrome Web Store URL, and swap any "coming soon" extension links.
10. Do not post the store link publicly until Sergey approves the post per the sprint's posting rules.

## Store listing tab

**Name** (75 char max, 65/75 used)
OpenApply Job Application Tracker: Save Jobs & Check Resume Match

**Summary** (132 char max, 114/132 used)
One click saves any job to your free job tracker and checks your resume match. Works on LinkedIn, Indeed and more.

**Description**

```
Found a job worth applying to? Click OpenApply in your toolbar.

SAVE TO YOUR JOB APPLICATION TRACKER
One click adds the job to your free OpenApply tracker. The extension reads the posting right in your browser, so it works on single-page job boards and on pages behind a login: role, company, location and the full description, which you can fix before saving. No copy and paste. Not signed up yet? You create a free account and the job is waiting for you.

CHECK MY RESUME MATCH
One click opens our free resume match checker with the job description already filled in. You get:
- a match score out of 100, weighted toward the must-have requirements
- every requirement marked matched, partial or missing, with the line from your resume that proves it
- the keywords from the posting that your resume doesn't mention
- what a resume parser actually sees in your PDF
It never rewrites your resume and never invents experience. Tick "Remember my resume in this browser" once, and every job after that is one click.

WORKS WHERE YOU SEARCH
LinkedIn, Indeed, Greenhouse, Lever, Ashby, Workable, and most company career pages. If we can't find the description on a page, select it with your mouse and click again.

PRIVATE BY DESIGN
- The extension reads a page only when you click it, and only that tab. No background access, no browsing history.
- It asks for the smallest permissions Chrome offers: the active tab, on click.
- The job description goes to the match tool in the part of the link that browsers never send to a server.
- Open source: read every line at https://github.com/SergeyKhval/OpenApply

WHAT IT DOESN'T DO
It does not fill out or submit job applications for you. It saves the job to your tracker and checks your resume against it; you still apply on the company's own site.

OpenApply is a free, open-source job application tracker. Track every application, interview and follow-up in one place, and use AI resume reviews and cover letters only when you want them.

Not affiliated with Faria Education Group's OpenApply school admissions platform.
```

**Category**: Productivity (alternative: Tools)
**Language**: English

**Graphic assets** (all in this folder)
- Store icon 128x128: `icon-128.png` (96px artwork with 16px transparent padding, per Chrome's guidelines)
- Screenshots 1280x800: `screenshots/1-save.png`, `screenshots/2-everywhere.png`, `screenshots/3-match.png`, `screenshots/4-result.png`, `screenshots/5-privacy.png`
- Small promo tile 440x280: `promo-small-440x280.png` (unchanged, still accurate for 1.1.1: "Save jobs and check your resume match in one click. Free and open source.")
- Marquee 1400x560: not made (optional, only used if Google features the extension)

The screenshots show a fictional posting (Northwind Labs) and a fictional resume. The popup shown in screenshots 1, 2, 3 and 5 is the real 1.1.1 popup markup and stylesheet (`extension/src/popup.html`/`popup.css`, unchanged) rendered with sample field values in place of the live Chrome APIs, composited onto a mocked job-board page for the marketing frame; screenshot 4 mocks the real resume-match result UI (score, verdict, matched/partial/missing requirements). No real company appears. Source: `extension/store/source/`.

**Official URL**: https://openapply.app (verify the domain in Search Console under the same Google account, if not already)
**Homepage URL**: https://openapply.app
**Support URL**: https://github.com/SergeyKhval/OpenApply/issues

## Privacy tab

**Single purpose**

```
Send the job posting in the current tab to OpenApply: either save it to the user's OpenApply job tracker, or check the user's resume against it with OpenApply's resume match tool.
```

**Permission justifications**

`activeTab`
```
When the user clicks the toolbar button, the extension reads the job posting in the current tab (its address, title, company and description) so it can save the job or check a resume against it. It has no access to any page the user hasn't clicked it on.
```

`scripting`
```
Used with activeTab to run a single read-only function in the current tab, after the user clicks the toolbar button, that extracts the job title, company and description text from the page. It does not modify the page and does not run on any other page.
```

**Remote code**: No, I am not using remote code. (All JavaScript ships in the package; the popup only opens openapply.app links in a new tab.)

**Data usage**: tick these, and nothing else

- [x] Website content: the job posting's title, company, location, description and address, only from the tab the user clicks the extension on, and only sent to openapply.app when the user clicks Save or Check my resume match.

Leave unticked: personally identifiable information, health, financial and payment, authentication, personal communications, location, web history, user activity.

(The resume is typed or uploaded on openapply.app, not in the extension, so it isn't extension data. The privacy policy covers it.)

Certify all three:
- [x] I do not sell or transfer user data to third parties, outside of the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL**: https://openapply.app/privacy (has a "Browser Extension" section at https://openapply.app/privacy#browser-extension)

## Distribution tab

- Visibility: Public
- Regions: all

## Notes for review speed

- No host permissions, no content scripts, no background service worker: the listing shows no "read and change your data on all websites" warning.
- If a reviewer asks how to test: open any job posting (for example a LinkedIn or Greenhouse job), click the OpenApply toolbar button, click either action.
