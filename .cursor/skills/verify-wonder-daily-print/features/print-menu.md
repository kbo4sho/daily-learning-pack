# Print menu on /today/

## Sub-features

- Closed by default; opens from the **Print** button.
- Entries: Print today (first), Foldable story, Math, Reading pages, Writing,
  Answer key, then extras (Table-top lab and its grown-ups guide).
- Closes on Escape (focus returns to Print) and on an outside click.
- Every `.pdf` link on the page answers 200 `application/pdf` with a `%PDF-` body.

## How to get to it (user POV)

Open `/today/`, tap **Print** in the header.

## Driving it with Playwright (Chromium)

`details.print-menu summary` click, then read `details.print-menu a` boxes at
390 px and 1280 px; `keyboard.press("Escape")`; `mouse.click` near the bottom
edge; `context.request.get(url)` for each PDF; click
`a[href$="kid-worksheets.pdf"]` and wait for the response.
End state: menu closed again, all entries on screen, PDFs fetched.

## Gotchas

Headless Chromium turns a click on a PDF into a download, which aborts the
page's own request; the check ignores only that one aborted request.
