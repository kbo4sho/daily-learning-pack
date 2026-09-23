# Wonder Daily — Curiosity-led quality mock

Task: `wd-curiosity-led-mock` · **Draft dogfood review only. Do not merge.**

This is the Grade 2 bean-sprout/growth bet: **A bean becomes.** Four child-wonder questions lead to four generated, single-scene Curiosity explainers. Only after the accepted plates existed and had been inspected were the reading, math, and writing authored. The default opening is Wonder, not a subject worksheet.

## Flow, in prose

**Theme → questions → plates → reading / math / writing.** Start with the quiet work of a bean growing. Choose a question about what is inside, which way roots grow, what leaves do, or how to notice a slow change. Look at that question's full scenic plate with a grown-up; open the optional explanation and small pointing/pretend activity when ready. Carry that same visual world into a cover and six-beat family story. Return to the noticing plate to compare pretend measurements, then choose the seed, root, or leaf plate to draw and explain an idea. A family can pause, go back, skip a task, or finish with one idea.

The story is parent-read, with a child-sized Open / Next control. It starts from a cover, shows one beat at a time, and uses the existing `src/reader.js` behavior. Entrance is opacity-only; reduced motion is still. Navigation preserves the current story beat and typed draft. No scores, timers, chat, runtime generation, or storage.

## The plate spine

All four accepted **1536 × 1024** PNG originals and their JPEG delivery copies are committed. PNGs preserve the generated originals; JPEG copies use encoding-only compression, without cropping or repainting. Each image is one coherent scene; the four-image set is the explicit packet expansion requested for this task.

| Plate / paths under `assets/curiosity-bean/` | Curiosity question | Story / learning bindings |
| --- | --- | --- |
| `01-wake.png` + `01-wake.jpg` — A beginning inside | What is waking up inside this little bean? | Cover; “Small, but not empty”; “Look back at the beginning”; stored-food writing frame |
| `02-root.png` + `02-root.jpg` — Two ways to grow | How does a root find its way when it cannot see? | “Down and up”; root direction / function writing frame |
| `03-leaf.png` + `03-leaf.jpg` — Leaves in the light | What can a leaf do that a seed cannot? | “A new way to make food”; leaf inputs writing frame |
| `04-notice.png` + `04-notice.jpg` — A change worth keeping | How could we notice a change too slow to watch? | “Too slow to see?”; “A question to keep”; all three math tasks and notebook table |

[`intent.json`](assets/curiosity-bean/intent.json) locks theme/questions before generation. [`prompts.json`](assets/curiosity-bean/prompts.json) contains the exact built-in image_gen prompts, including the rejected first seed attempt. [`provenance.json`](assets/curiosity-bean/provenance.json) records every accepted asset's SHA-256, byte size, local generation source, and conversion method. The first seed attempt was rejected for drifting toward photorealism and toy-like volume. The accepted, flatter gouache seed plate became the style/character reference for the remaining three. Big and Little Wonderer stay quiet, nonhuman Pebble Guides alongside the actual mechanism.

## How the learning grows from the images

- **Reading:** `reading.beats` is the single source for screen, still worksheet, and folded book. Six short passages follow seed food → root and shoot → leaf inputs → a recorded change → rethink the beginning → a question to keep. Every beat has a plate ID. Questions invite evidence and conversation; there is no trivia quiz.
- **Math:** the earlier marker and notebook in plate 4 motivate a clearly labeled **pretend** table: Day 4 = 8 cm; Day 8 = 14 cm; Day 12 = 23 cm. Tasks are 14 − 8 = 6 cm, 23 + 9 = 32 cm, and 12 − 4 = 8 elapsed days. The image is explicitly not a scale ruler. Optional hints bridge through ten or count gaps. Children calculate on paper or explain aloud.
- **Writing:** choose the seed, root, or leaf scene; the plate and matching sentence frame change together. Draw a part and action arrow, say the idea, then write 1–3 sentences or dictate. Word bank, read-back invitation, temporary textarea, and a quiet finish support the parent.
- **Parent support:** each activity has pacing guidance; the separate parent answer key explains the math, story evidence, acceptable written/oral responses, and scientific simplifications. The guidance welcomes stopping early.

The three existing portrait Letter worksheet outputs and separate parent key are intact. Math and writing print lead with the committed scenic plates (notice; wake/root/leaf), captioned and grayscale-treated so the paper object matches the foldable story family. The still story keeps compact line drawings so the same six passages fit one Letter page. Browser Print does not expand hidden story beats.

Author checks: [Illinois Extension on germination](https://web.extension.illinois.edu/gpe/case3/c3facts3.html), [seed structure](https://web.extension.illinois.edu/gpe/case3/c3facts2.html), [leaves](https://web.extension.illinois.edu/gpe/case1/c1facts2c.html), and [NASA on plant gravity perception](https://www.nasa.gov/ames/space-biosciences/plant-gravity-perception-spacex-13/). These are author references; no scientific source is fetched during build or use.

## Fold status: LIVE

The quiet **Download foldable story** control is in the family reader chrome. `src/zine.js` lightly ports the recipe from merged [super-dad PR #37 — Practices: download a one-sheet foldable family story](https://github.com/kbo4sho/super-dad/pull/37), inspected at merge commit `7fcc9a91c37ae291b04061aa67da6e69f4e01b2d`.

- Client-side PDF, lazily loading a **locally bundled** pdf-lib; no CDN, service, or generation request.
- Exactly **one single-sided landscape US Letter sheet, 792 × 612 pt**. Eight panels, each 198 × 306 pt.
- Physical order, left-to-right: **top 5 | 4 | 3 | 2, each rotated 180°; bottom 6 | 7 | 8 | 1, upright.**
- Page 1 is the cover, 2–7 are the same six story beats and bound plates, and page 8 has print/fold steps, a tiny center-cut diagram, and a parent-led note.
- Fewer than six beats receive quiet pause panels. More than six beats, missing art, or overflowing text fail clearly. The mock does not silently ellipsize story passages.
- Busy state prevents duplicate jobs. Library/image failures display a retry instruction beside the control and keep the ordinary Print story alternative. Library and image waits are bounded.
- Like PR #37, the small PDF uses embedded standard serif/sans fonts (Times / Helvetica); digital reader and Letter worksheets use locally bundled Newsreader / Inter.

**Print one-sided, Letter landscape, actual size / 100%, no fit, headers/footers off.** Fold long edge to long edge and reopen; fold short edge to short edge, then in half again; reopen to eight boxes. A grown-up cuts only the solid center line across the middle two boxes. Refold lengthwise, print outside, push the ends into a cross, then wrap with page 1 in front. **A physical printer/fold check remains manual.**

## Preview and branch isolation

Branch: `codex/curiosity-led-mock`, created from fetched `origin/main` at `fc65dac`. Separate worktree: `/Users/kevinbolander/Documents/daily-learning-pack-curiosity`. The original checkout and `codex/bean-sprout-g2` / PR #7 were left alone. Nothing is merged, deployed, or connected to public Wonder Together navigation.

```sh
cd /Users/kevinbolander/Documents/daily-learning-pack-curiosity
npm ci
npx playwright install chromium webkit
npm run generate -- "curiosity bean"
PORT=4175 npm run preview
```

Open **http://127.0.0.1:4175/daily-learning-pack/**. A preview server was left running there at handoff. On a fresh checkout, start it with the commands above. Port 4175 avoids interfering with existing local work. `bean sprout`, `bean sprouts`, and `curiosity bean sprout` also select this mock on this branch. **`npm run build` still restores engines.**

PR checks build/test the existing packs first, then this mock, and upload the Curiosity site, worksheets, browser-generated fold PDF, and stills in the private repository's `daily-learning-pack-preview` artifact. No public preview was published. `noindex` is a crawler hint, not authentication; keep dogfood local or in private artifacts.

## Verification

- `npm run build` — default engines build succeeds.
- `npm test` — **11/11** unit/integration tests pass; includes all plate hashes/bindings, exact story sharing, fold limits/padding, one-sheet dimensions, no print scaling, embedded image reuse, and honest failure on missing art/long copy.
- `npm run test:inquiry` — weather build and fair-sharing browser matrix pass, then engines is restored.
- Existing engines and inchworms — Chromium + WebKit at **820×1180, 390×844, 1024×768** pass.
- Curiosity browser matrix — those same six configurations pass. Covers all four questions and images; cover plus every reader beat; one-screen fit at normal text size; keyboard, focus, opacity-only motion, live reduced-motion change, current-beat retention, browser Print; actual PDF download and image failure/retry; math hints; scene selection; draft retention; finish; 200% text reflow; no-JS fallback; and automated WCAG A/AA checks.
- Formatter and `git diff --check` pass. No separate typecheck script exists in this JavaScript repo.
- Frontend premium strict static audit: **0 findings**. DESIGN.md lint: **0 errors**; informational mirror-token warnings do not affect runtime CSS ownership.
- Poppler renders inspected visually: imposed fold sheet, all three grayscale kid pages, and separate grayscale parent key. Browser stills inspected for opening, phone/iPad reader, math, and writing.

Review evidence is in `docs/stills/curiosity-*`. Automated scratch captures remain under ignored `output/`; no node_modules, .vercel, or Playwright session data is committed.

## Self-adversarial pass — not merge-ready

**Does Curiosity really lead?** The opening exposes the four questions and a full scenic image before any subject task; answers are optional disclosures. Reading and tasks are visibly connected to the same scenes. On a narrow phone the question list precedes the first image, so the image is below the initial fold. Choosing a question scrolls to its scene. Captain should judge whether that tradeoff preserves enough visual pull.

**Is the science overclaimed?** No timetable is asserted. Measurements are pretend, scale is illustrative, and gravity is a growth response rather than a thinking root. The generated seed anatomy and cutaway remain simplified; real common beans lift cotyledons as they emerge, and the intermediate plate is not a complete botany sequence. Parent copy identifies images as explanations, not observation records. A science editor could still refine the root/seed junction before any public curriculum use.

**Is this a worksheet with decorative art?** The plate registry and shared bindings prevent detached subject illustrations. The math numbers, however, are an authored model placed beside the noticing scene, not measurements recoverable from the artwork. This is explicit. Captain should decide whether a later iteration needs a more hands-on measurement interaction.

**Does the reader hold up?** Every normal-size beat fits the tested phone/iPad/small-laptop viewports. 200% text and expanded fold instructions deliberately scroll rather than clip. Browser testing is Chromium/WebKit emulation, not a physical iPad/Safari printer workflow. Story and writing drafts are session-only and are not retained on reload.

**Does the paper object work?** Structural tests and rendered inspection pass the exact PR #37 imposition. The book is small; its 9.5 pt story copy and reduced illustrations need a real printer/parent check. The B&W worksheet twin stays available. No physical cut/fold or child comprehension test has been performed.

**Does it meet the illustration bar?** The flat watercolor/gouache scenes, small pebble pair, and orange explainer notes form a coherent set. Repetition of the windowsill is intentional continuity, but it may feel too samey over repeated visits. Captain should approve character continuity and whether the atmosphere feels like Curiosity rather than a generic nature book.

**Any rollout assumption?** None. This is one authored pack and a hidden local/private-artifact mock. No public-nav change, CMS, photo upload, runtime AI, production deployment, or merge is included. PR #7 remains a separate line of work; the two bean implementations would need a deliberate future reconciliation.

**Blockers:** none to local dogfood or draft review. Physical fold, real-device review, and family comprehension remain human review items; they are not claimed complete.

**Suggested captain ask:** Try the four questions before reading any explanation. Does the picture make you want to wonder together, and do reading, math, and writing feel like natural returns to that same little world? Then print/fold one sheet and confirm pages 1–8 read upright.
