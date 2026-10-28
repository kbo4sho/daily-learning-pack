# Verification record: a parent prints today's pack as a PDF

Feature: a parent opens `/today/`, taps **Print**, picks a sheet, and prints a
clean US Letter PDF. This is the critical path of the public pack, so it is
checked on every pull request and every push to `main`.

- Check: `tests/print-browser.mjs` (`npm run verify:print`; also the first step
  of `npm run test:browser`, which the `check` job in
  `.github/workflows/check.yml` runs).
- Agent skill and feature map: `.cursor/skills/verify-wonder-daily-print/`.
- Evidence a run leaves behind: `output/print-verify/` (sample PDFs, one PNG
  per printed page, menu screenshots, `summary.json`). Not committed: it is
  rebuilt from the day on `/today/`, so it changes every morning. The script wipes
  the PNG, PDF and JSON files of its own earlier run (it leaves a `.print-verify`
  marker in the folder) before writing new ones.

## What the check does

It builds nothing itself; CI runs `npm run archive` first, then serves `dist/`
on a random local port and drives Chromium and poppler. It stops at once with a
clear message if `pdfinfo`, `pdftotext`, `pdftoppm` or `pdfimages` is missing
(`poppler-utils`; `family.test.mjs` already needs it in CI).

| # | Step | Passes when |
| --- | --- | --- |
| 1 | Open `/today/` at 390 px and 1280 px, tap **Print** | The menu starts closed, opens, lists Print today (first), Foldable story, Math, Reading pages, Writing, Answer key by those labels, and every entry present (the Table-top lab extras too) is visible and on screen |
| 2 | Escape, then an outside click | Menu closes; focus returns to the Print button |
| 3 | Fetch every `.pdf` link on the page | Stays on the local site under `/today/pdf/`, HTTP 200, `application/pdf`, body starts `%PDF-` and equals `dist/today/pdf/<name>.pdf` byte for byte |
| 4 | Click **Print today** | The browser requests `kid-worksheets.pdf` and gets a PDF |
| 5 | Read each linked PDF with `pdfinfo`, `pdftotext`, `pdftoppm`, `pdfimages` | Every page is US Letter; has a title; every page renders with ink (no blank sheet, at least 1% dark pixels); every page has text or a picture; the Foldable is one sheet with a real picture; "Print today" is the Math, Foldable and Writing sheets in that order, compared page by page as pictures |
| 6 | Header text | "Wonder Daily" and `Age <targetAge from pack.json>` on Print today, Math, Reading and Answer key; today's title present; no age range ("Ages 6-8"); every printed `AGE n` equals the pack age |
| 7 | Privacy | No private name, host name or local path (`privacyIssues` from `scripts/privacy-check.mjs`, including `WD_PRIVATE_NAMES`), and no process note, model name or `/Users`, `/home`, `/tmp` path (a local pattern in the check) in PDF text or metadata |
| 8 | Same bytes | `/today/pdf/*.pdf` equals `/days/<slug>/pdf/*.pdf` |
| 9 | `/today/` text | Page text (scripts and styles removed) shows `Age <targetAge>` and no age range |
| 10 | Browser Print of `/today/` (`page.pdf`, print media) | At most 3 sheets, today's title, points at the Print menu, every image loaded, no empty sheet (at least 0.2% ink) |
| 11 | Browser Print of `/welcome/` | Exactly 2 Letter sheets, at least 6 real pictures in the PDF (`pdfimages`, soft masks excluded), every image loaded |

No check in this file changes published pages; the script only reads `dist/`.

## A green run (2026-10-28, pack day `how-sidewalks-work`, age 8)

| PDF | Sheets | Lowest ink share |
| --- | --- | --- |
| Print today (`kid-worksheets`) | 4 (math 2, foldable 1, writing 1) | 4.9% |
| Foldable story | 1 | 36% |
| Math | 2 | 4.9% |
| Reading pages | 2 | 13% |
| Writing | 1 | 17% |
| Answer key | 3 | 4.6% |
| Table-top lab / guide | 2 / 1 | 6.4% / 13% |
| Browser Print of `/today/` | 2 | 2.1% (page 2 is the end of the question list) |
| Browser Print of `/welcome/` | 2 | 23% |

## Proof that it can fail

Each of these was applied to a copy of `dist/` and the check went red:
a PDF replaced by a blank page ("looks blank"), a PDF deleted (404), a link
pointing off the site or at another folder, a renamed menu label, "Print today"
made of Math twice ("sheet 3 is not foldable"), the pack
age changed (header no longer says it), the Print menu markup removed, the
Escape handler removed, the welcome art deleted ("pictures not loaded for
print"), "Age 8" changed to "Ages 6-8" on the page, and a name added to
`WD_PRIVATE_NAMES` that appears in the PDFs.

## When it fails

1. Run `npm run archive && npm run verify:print` locally.
2. Open the PNGs in `output/print-verify/` for the sheet named in the error.
3. If the layout change is intended (for example a new sheet in the bundle),
   change the check and this record in the same pull request. Do not loosen an
   assertion to get green.

## Not covered

`/little/` print link (`tests/little-browser.mjs` covers the link), `/family/print/`,
a physical printer, and Safari/Firefox print engines (`page.pdf` is Chromium only).
