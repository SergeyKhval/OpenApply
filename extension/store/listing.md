# Chrome Web Store listing kit

Everything the Chrome Web Store developer dashboard asks for, ready to paste.
Upload file: `pnpm build:extension` (repo root) writes `extension/dist/openapply-extension-<version>.zip`.

## Store listing tab

**Name** (from manifest, 43/75 chars)
OpenApply: Save Jobs and Check Resume Match

**Summary** (from manifest, 118/132 chars)
Save any job posting to your OpenApply tracker in one click, or check how your resume matches it. Free and open source.

**Description**

```
Found a job worth applying to? Click OpenApply in your toolbar.

SAVE TO OPENAPPLY
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

OpenApply is a free, open-source job application tracker. Track every application, interview and follow-up in one place, and use AI resume reviews and cover letters only when you want them.

Not affiliated with Faria Education Group's OpenApply school admissions platform.
```

**Category**: Productivity (alternative: Tools)
**Language**: English

**Graphic assets** (all in this folder)
- Store icon 128x128: `icon-128.png` (96px artwork with 16px transparent padding, per Chrome's guidelines)
- Screenshots 1280x800: `screenshots/1-save.png`, `screenshots/2-check.png`, `screenshots/3-result.png`
- Small promo tile 440x280: `promo-small-440x280.png`
- Marquee 1400x560: not made (optional, only used if Google features the extension)

The screenshots show a fictional posting (Northwind Labs) and a fictional resume, run through the real extension and the real match tool. No real company appears.

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
