# Daily Learning Pack

**One topic. Three small discoveries.** A calm daily pack for **2nd grade (roughly ages 7–8)**: about **15 minutes math + 15 reading + 15 writing**. Use the iPad to notice and try; use paper to draw, think, and explain. A grown-up can read instructions aloud and take dictation.

The default complete sample day is **“engines.”** Leo and Jo explore how a push becomes a turn, add and subtract model engine turns, read _The push inside_, and explain how fuel, a piston, a rod, and a crankshaft work together. The original **“fractions as fair sharing”** day remains available as another curated sample. No accounts, backend, tracking, external font requests, or AI calls. The kid experience is static HTML, CSS, and a small JavaScript file.

![The sample math lesson at an iPad-sized viewport](docs/stills/ipad-math.png)

## Generate a day

Requires **Node.js 22+**, npm, and a one-time Chromium download for PDF generation. The browser is a build tool; children do not download it.

```sh
npm ci
npx playwright install chromium
npm run build
```

`npm run build` produces the Grade 2 engines day. To supply the **only required input**, pass one quoted topic string:

```sh
npm run generate -- "engines"
npm run generate -- "fractions as fair sharing"
npm run generate -- "weather"
```

Every successful generation replaces the current `dist/` day and the five `output/pdf/` files. The default engines sample is restored with `npm run build`. Generation needs no API keys or network access after dependencies and the browser are installed.

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

- `engines` and `fractions as fair sharing` (ignoring case and extra spaces) select their carefully authored packs. No topic argument selects engines.
- Any other topic produces a **topic inquiry pack**: count the words and letters in that topic, explore grouping, read an original question-led story about it, and write an on-topic question. All three subjects use the same input string. No second input or reference book is required.
- Inquiry packs do **not** claim to teach factual concepts about arbitrary topics. They are usable language-and-counting activities, and a starting point for authoring a topic-specific lesson. The site and parent note label this mode. This repository contains two curated days, not a curriculum or an automatic factual lesson writer.
- Topics must contain letters and be 1–80 characters after whitespace normalization. The content is English; the shipped font subsets target Latin-script topics. HTML metacharacters are escaped. Generation rejects print overflow instead of delivering clipped worksheets.

## Grade 2 authoring default

Future days target **2nd grade**, not just an age label: use short sentences and concrete vocabulary; explain necessary topic words in context; practice addition and subtraction within 100, tens and ones, and simple skip counting. Offer drawing, oral rehearsal, sentence frames, a word bank, and wide writing lines with dashed midlines. Read-aloud help and dictation are welcome. Each subject has a 15-minute parent plan; the times include talk and drawing.

For engines, math uses **24 + 18**, **60 − 42**, and **counting by 2 to 20**. Reading is an original five-paragraph cause-and-effect story with vocabulary and two evidence questions. Writing asks for **three short explanatory sentences**, using “First / Next / Then” frames and a labeled drawing. The separate key includes calculation strategies, reading evidence, a model response, and guidance about the simplified mechanism.

The engine lesson describes a **gasoline piston engine**. Fuel burns with air; expanding hot gases push a piston linked by a rod to a turning crankshaft. It does not imply that every engine works this way or that all fuel energy becomes motion. The parts diagram omits timing, valves, and drivetrain details; the turn counter is a number model, not a speed or fuel simulation. Factual reference for authors: [U.S. Department of Energy, Internal Combustion Engine Basics](https://www.energy.gov/cmei/vehicles/articles/internal-combustion-engine-basics). No factual source is fetched at build time or runtime.

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

`packs/engines.json` is the default reference format, version `1`; `packs/fair-sharing.json` remains a second example. `src/pack.mjs` resolves a topic to the expanded object; `src/render.mjs` renders that object into both print and digital pages. The generator uses Playwright Chromium to print HTML to vector PDFs so both media share typography. Its page-boundary guard catches content that collides with the parent footer.

| Field                            | Contract                                                                                                       |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`, `kind`, `topic` | Version, interaction type (`engines`, `fair-sharing`, or `topic-inquiry`), single source topic                 |
| `gradeLevel`, `ageRange`         | Default `2` and `[7, 8]`, included in curated packs and generated inquiry metadata                             |
| `title`, `question`, `idea`      | Day title, curiosity prompt, explicit core idea                                                                |
| `math`                           | Title, introduction, three tasks, extension, timed parent note; engines adds two `workspaces` equation prompts |
| `reading`                        | Title, original story paragraphs, three word/meaning pairs, two questions, parent note                         |
| `writing`                        | Title, introduction, drawing prompt, sentence starter, word bank, reread check, parent note                    |
| `answers`, `parentGuidance`      | Labeled answers and teaching notes, rendered separately                                                        |

To author another curated topic later, copy the reference JSON, write and review all three subjects and their answers, and add an exact topic mapping in `curatedPacks` in `src/pack.mjs`. Keep `gradeLevel: 2` and `ageRange: [7, 8]` in new curated packs; the inquiry fallback uses the exported Grade 2 defaults. `kind` selects a corresponding teaching interaction; introduce a new renderer and interaction for a different concept instead of reusing fraction controls for unrelated material. Keep copy within one page per subject and run the build and checks. No model or service is involved at runtime.

## Design principles

- **Show why.** Follow stored energy in fuel to hot gases, a piston push, and a turning crankshaft. A labeled diagram makes the connections visible; pairs of model turns support skip counting. The fair-sharing sample keeps its equal-area interaction and unequal counterexample.
- **One connected day.** The math action becomes a reading problem, then something the child can teach in writing.
- **Warm, clear, spacious.** Locally bundled Fraunces headings and Nunito Sans text; deep green ink, sunny yellow, sky blue, and a little pink. Functional geometry carries the lesson without heavy images.
- **Paper is a first-class surface.** Physical Letter dimensions, high contrast, unfilled drawing areas, 36-point writing lines with dashed midlines, short grown-up notes, and a separate key.
- **Touch and attention matter.** Large controls, keyboard support, visible focus, announced feedback, optional gentle motion, and `prefers-reduced-motion` support. No timers, scores, or login gates.
- **Progress is forgiving.** A child can revisit every subject. Talk, pointing, drawing, and dictation are valid ways to work. Without JavaScript, all three lessons and PDF links remain readable.

Fonts are distributed under their bundled SIL Open Font Licenses in the build’s `fonts/` directory. The site uses no raster art or third-party requests.

## Verification

```sh
npm run build
npm test
npx playwright install webkit
npm run test:inquiry
npm run test:browser
```

On Linux CI, use `npx playwright install --with-deps chromium webkit` ([Playwright browser setup](https://playwright.dev/docs/browsers)). Unit checks cover the engines default, Grade 2 metadata, curated topic resolution, fallback consistency, escaping, page counts, and Letter dimensions. The inquiry check builds weather, builds and browser-tests fair sharing, then restores engines even on failure. Browser checks exercise Chromium and WebKit at 820×1180, 390×844, and 1024×768, relative project paths, paired-turn counting through 20, keyboard input, reset, reduced motion, sharing/counterexample behavior, reading and writing, progress, no external asset requests, no-JavaScript reading, enlarged text, and automated accessibility on each tablet subject. WebKit emulation is useful Safari coverage; it is not an actual iPad hardware test.

The browser check refreshes the three engines review screenshots in `docs/stills/`; fair-sharing checks use a `fair-sharing-` filename prefix. For print review, install Poppler and render the actual PDFs:

```sh
mkdir -p tmp/pdfs
pdftoppm -scale-to 1200 -png output/pdf/kid-worksheets.pdf tmp/pdfs/kid
pdftoppm -scale-to 1200 -png output/pdf/parent-answer-key.pdf tmp/pdfs/key
```

Inspect every rendered page after changing print content or layout. Build artifacts are ignored by Git and recreated by the documented build; review stills and the source pack are committed.
