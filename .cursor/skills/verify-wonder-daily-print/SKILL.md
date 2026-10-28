---
name: verify-wonder-daily-print
description: Drive and prove the Wonder Daily critical path "a parent prints today's pack as a PDF" on the built dist/ (static site on GitHub Pages) with Chromium and poppler. Use before merging anything that touches dist/, src/, print CSS, the Print menu, the PDFs, or tests, and whenever printing looks wrong.
---

# Verify: a parent prints today's pack as a PDF

The surface is a static site. A parent opens `/today/`, taps **Print**, and
picks a PDF (Print today, Foldable story, Math, Reading pages, Writing, Answer
key, plus Table-top lab extras). The PDFs are prebuilt Letter files under
`dist/today/pdf/` (same bytes under `dist/days/<slug>/pdf/`). Browser Print of the
live page is a short sheet that points back at the Print menu. The hidden
`/welcome/` page has its own two-sheet print layout. Nothing needs a server
beyond `scripts/serve.mjs`, and nothing here calls the network.

## Launch

```sh
npm ci                                   # once
npx playwright install chromium          # once (CI uses --with-deps)
npm run archive                          # rebuild dist/ chrome; CI does the same
npm run verify:print                     # the whole proof (about 5 s)
```

`verify:print` is `node tests/print-browser.mjs`. It starts its own static
server on a random port (so it never collides with `npm run preview` on 4173)
and tears it down. It needs `pdfinfo`, `pdftotext`, `pdftoppm`, `pdfimages`
(poppler-utils; `brew install poppler` on macOS; present on ubuntu-latest).
Ready means the last line reads `print-browser: all checks passed`.
CI runs it inside the existing `check` job via `npm run test:browser`.

## Doctor

Read-only: `command -v pdfinfo pdftotext pdftoppm pdfimages && ls dist/today/pdf dist/today/pack.json && node -e "console.log(JSON.parse(require('fs').readFileSync('dist/today/pack.json')).targetAge)"`.
If `dist/today/pdf` is missing, `dist/` is stale: run `npm run archive`. If
Chromium is missing, run `npx playwright install chromium`.

## Drive

Everything is in `tests/print-browser.mjs`; read it before changing a check.
Handles it uses: `details.print-menu` and its `summary`, `a[href$=".pdf"]`,
`#daily-content`, `pack.json` (`title`, `targetAge`, `slug`), and the PDF
files themselves. To point it at another build or evidence folder:

```sh
WD_TEST_ROOT=/path/to/dist WD_PRINT_EVIDENCE=/path/to/evidence node tests/print-browser.mjs
```

To drive by hand (for a new feature): `npm run preview`, open
`http://127.0.0.1:4173/daily-learning-pack/today/`, click **Print**, click
**Print today**; for browser Print use Playwright `page.emulateMedia({media:"print"})`
then `page.pdf({format:"Letter"})`, never a test-only setter.

## Evidence

Written to `output/print-verify/` (git-ignored) or `WD_PRINT_EVIDENCE`:
sample PDFs, one 50 dpi PNG per printed page (`<name>-p-N.png`), menu
screenshots (phone and desktop, open and closed), the browser-print PDFs, and
`summary.json` (pages, titles, ink per page). Proof standards: exercise the
real click and the real `page.pdf()` print path; read the PDF bytes with
poppler, not the HTML that links to them; look at the PNGs when a check fails.
`docs/verification/print-pdf.md` records what a green run looked like.

## Cleanup

The script closes its own browser and server. Scratch copies you make with
`WD_TEST_ROOT` are yours to delete. Evidence is never deleted by the script;
delete `output/print-verify/` only when you no longer need it. Never kill
processes by name.

## Features

See `features/README.md` for the map (print menu, PDF set, browser print,
welcome print). The check fails closed: if a feature is moved, update the check
and the map in the same change instead of loosening an assertion.
