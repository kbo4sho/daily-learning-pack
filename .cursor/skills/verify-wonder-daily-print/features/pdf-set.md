# The printable PDF set

## Sub-features

- US Letter, a document title, one PNG-visible page per sheet (no blank page).
- "Print today" is the math, foldable and writing sheets in that order,
  compared page by page as pictures.
- Every page of every PDF is US Letter.
- Header text says Wonder Daily and `Age <targetAge>` (never an age range) on
  math, reading, answer key, and Print today.
- No private name or process note in the text or metadata.
- `/today/` and `/days/<slug>/` hold identical bytes.

## How to get to it (user POV)

Pick an entry in the Print menu; the PDF opens or downloads, then prints.

## Driving it with poppler

`pdfinfo` (pages, size, title), `pdftotext -layout -f N -l N` per page,
`pdftoppm -r 50 -png` then ink share per page, `pdfimages -list` for
picture-only sheets. End state: all assertions in `checkPdf` pass.

## Gotchas

The foldable is one picture (no text layer), so it is checked by ink and by
requiring a real picture (soft masks do not count). Letter-spaced headers print as `A G E 8`; the check strips
whitespace before matching.
