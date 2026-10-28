# Browser Print of /today/

## Sub-features

- Ctrl+P of the live day is deliberately short (at most 3 sheets), names
  today's pack (its title or its reading title), and tells the parent to use the Print menu.
- Every image on the page finished loading by the time it prints.

## How to get to it (user POV)

On `/today/`, press Ctrl/Cmd+P.

## Driving it with Playwright

`page.emulateMedia({media:"print"})` then `page.pdf({format:"Letter",
printBackground:true})` (this fires `beforeprint` itself), then the same
poppler checks as the PDF set.

## Gotchas

If the print CSS starts printing the whole interactive page, the sheet count
grows past 3 and the check fails on purpose (multi-MB spool).
