# Daily Learning Pack

**One topic. Three small discoveries.** A calm daily pack for early elementary learners: about **15 minutes math + 15 reading + 15 writing**. Use the iPad to notice and try; use paper to draw, think, and explain. A grown-up can read instructions aloud and take dictation.

The complete sample day is **“fractions as fair sharing.”** Leo explores a single whole, makes equal parts, reads _The picnic puzzle_, and explains how to share a sandwich fairly. No accounts, backend, tracking, external font requests, or AI calls. The kid experience is static HTML, CSS, and a small JavaScript file.

![The sample math lesson at an iPad-sized viewport](docs/stills/ipad-math.png)

## Generate a day

Requires **Node.js 22+**, npm, and a one-time Chromium download for PDF generation. The browser is a build tool; children do not download it.

```sh
npm ci
npx playwright install chromium
npm run build
```

`npm run build` produces the sample. To supply the **only required input**, pass one quoted topic string:

```sh
npm run generate -- "fractions as fair sharing"
npm run generate -- "weather"
```

Every successful generation replaces the current `dist/` day and the five `output/pdf/` files. The default sample is restored with `npm run build`. Generation needs no API keys or network access after dependencies and the browser are installed.

| Output                                            | Purpose                                       |
| ------------------------------------------------- | --------------------------------------------- |
| `dist/index.html`                                 | Complete static learning experience           |
| `dist/pdf/kid-worksheets.pdf`                     | Three US Letter pages: math, reading, writing |
| `dist/pdf/math.pdf`, `reading.pdf`, `writing.pdf` | Individual one-page worksheets                |
| `dist/pdf/parent-answer-key.pdf`                  | Separate one-page parent key                  |
| `dist/print/*.html`                               | Inspectable print sources                     |
| `dist/pack.json`                                  | Fully expanded day data                       |
| `output/pdf/`                                     | The same five PDFs, convenient for printing   |

Print the kid PDF at **100% / actual size**, one-sided, on US Letter. Everything is legible in black and white; no answer depends on color. The parent key is deliberately absent from the kid PDF. Each 15-minute session includes discussion or drawing, not 15 minutes of worksheet filling. Use a pencil and scrap paper; crayons are optional.

### What “topic in → day out” means in this scaffold

- The sample topic (ignoring case and extra spaces) selects the carefully authored fractions pack.
- Any other topic produces a **topic inquiry pack**: count the words and letters in that topic, explore grouping, read an original question-led story about it, and write an on-topic question. All three subjects use the same input string. No second input or reference book is required.
- Inquiry packs do **not** claim to teach factual concepts about arbitrary topics. They are usable language-and-counting activities, and a starting point for authoring a topic-specific lesson. The site and parent note label this mode. This PR contains one curated day, not a curriculum or an automatic factual lesson writer.
- Topics must contain letters and be 1–80 characters after whitespace normalization. The content is English; the shipped font subsets target Latin-script topics. HTML metacharacters are escaped. Generation rejects print overflow instead of delivering clipped worksheets.

## View locally

```sh
npm run preview
```

Open **http://127.0.0.1:4173/daily-learning-pack/**. The project prefix intentionally matches GitHub Pages. All asset and download paths are relative.

For an actual iPad on the same Wi-Fi, run `HOST=0.0.0.0 npm run preview`, then open `http://YOUR-MAC-LAN-IP:4173/daily-learning-pack/` in Safari. The preview is temporary; stop it with Ctrl-C. Digital writing stays in memory while switching subjects and disappears on reload. There is no storage or submission.

## GitHub Pages

This PR does **not** merge, publish, enable Pages, or push to main. PR checks upload a downloadable `daily-learning-pack-preview` artifact containing the built site, PDFs, and screenshots.

When you choose to publish after review:

1. Merge the reviewed PR yourself.
2. In **Settings → Pages → Build and deployment**, choose **GitHub Actions**.
3. In **Actions → Publish learning pack to Pages → Run workflow**, select `main`.
4. The expected project URL is **https://kbo4sho.github.io/daily-learning-pack/**. It is not live merely because the build exists.

The deployment workflow is manual and restricted to `main`; PR checks have no deployment permissions. A private repository needs a plan that supports private-repo Pages (for a personal account, GitHub Pro). A public Pages site can be viewed without a login even when its source repository is private. See [GitHub’s custom Pages workflow guide](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) and [Pages visibility](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages#limits-on-use-of-github-pages). No repository settings are changed by this scaffold.

## Pack format and extension points

`packs/fair-sharing.json` is the reference format, version `1`. `src/pack.mjs` resolves a topic to the expanded object; `src/render.mjs` renders that object into both print and digital pages. The generator uses Playwright Chromium to print HTML to vector PDFs so both media share typography. Its page-boundary guard catches content that collides with the parent footer.

| Field                            | Contract                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------- |
| `schemaVersion`, `kind`, `topic` | Version, interaction type (`fair-sharing` or `topic-inquiry`), single source topic          |
| `title`, `question`, `idea`      | Day title, curiosity prompt, explicit core idea                                             |
| `math`                           | Title, introduction, three tasks, extension, timed parent note                              |
| `reading`                        | Title, original story paragraphs, three word/meaning pairs, two questions, parent note      |
| `writing`                        | Title, introduction, drawing prompt, sentence starter, word bank, reread check, parent note |
| `answers`, `parentGuidance`      | Labeled answers and teaching notes, rendered separately                                     |

To author another curated topic later, copy the reference JSON, write and review all three subjects and their answers, and add an exact topic mapping in `createPack`. `kind` selects a corresponding teaching interaction; introduce a new renderer and interaction for a different concept instead of reusing fraction controls for unrelated material. Keep copy within one page per subject and run the build and checks. No model or service is involved at runtime.

## Design principles

- **Show why.** Equal area is the condition for halves and fourths. The whole keeps its size while partitions change; selecting two fourths reveals a half. An unequal counterexample tests the idea.
- **One connected day.** The math action becomes a reading problem, then something the child can teach in writing.
- **Warm, clear, spacious.** Locally bundled Fraunces headings and Nunito Sans text; deep green ink, sunny yellow, sky blue, and a little pink. Functional geometry carries the lesson without heavy images.
- **Paper is a first-class surface.** Physical Letter dimensions, high contrast, unfilled drawing areas, 36-point writing lines with dashed midlines, short grown-up notes, and a separate key.
- **Touch and attention matter.** Large controls, keyboard support, visible focus, announced feedback, optional gentle motion, and `prefers-reduced-motion` support. No timers, scores, or login gates.
- **Progress is forgiving.** A child can revisit every subject. Talk, pointing, drawing, and dictation are valid ways to work. Without JavaScript, all three lessons and PDF links remain readable.

Fonts are distributed under their bundled SIL Open Font Licenses in the build’s `fonts/` directory. The initial page uses no raster art or third-party requests.

## Verification

```sh
npm run build
npm test
npm run test:inquiry
npx playwright install webkit
npm run test:browser
```

On Linux CI, use `npx playwright install --with-deps chromium webkit` ([Playwright browser setup](https://playwright.dev/docs/browsers)). Unit checks cover topic resolution, fallback consistency, escaping, page counts, and Letter dimensions. Browser checks exercise Chromium and WebKit at 820×1180, 390×844, and 1024×768, relative project paths, sharing/reset/counterexample behavior, reading and writing, progress, no external asset requests, no-JavaScript reading, enlarged text, and automated accessibility on each tablet subject. WebKit emulation is useful Safari coverage; it is not an actual iPad hardware test.

The browser check refreshes the three review screenshots in `docs/stills/`. For print review, install Poppler and render the actual PDFs:

```sh
mkdir -p tmp/pdfs
pdftoppm -scale-to 1200 -png output/pdf/kid-worksheets.pdf tmp/pdfs/kid
pdftoppm -scale-to 1200 -png output/pdf/parent-answer-key.pdf tmp/pdfs/key
```

Inspect every rendered page after changing print content or layout. Build artifacts are ignored by Git and recreated by the documented build; review stills and the source pack are committed.
