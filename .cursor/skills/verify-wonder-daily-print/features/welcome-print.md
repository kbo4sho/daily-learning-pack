# /welcome/ print

## Sub-features

- Two Letter sheets with the art. Only the header link (`.w-start`) is hidden
  in print; the form's sign-up button (`.w-form button`) is printed. The page is noindex
  and unlinked; this check never links to it.

## How to get to it (user POV)

Only by its direct address.

## Driving it with Playwright

Same `page.pdf()` recipe as browser print; asserts 2 pages, at least 6 raw PDF
image objects, every `<img>` loaded. `tests/welcome-browser.mjs` has the
detailed layout checks.

## Gotchas

If the welcome layout intentionally changes its sheet count, update this check
and `tests/welcome-browser.mjs` together.
