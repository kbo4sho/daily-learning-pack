# Wonder Daily — one-click heirloom packets

Task 123 replaces the archive’s three-press ritual with one native link per packet. Leo’s door opens `today/`; shelf packets open their own `days/<slug>/`. The only JavaScript adds Space activation. Clicking and Enter work without JavaScript.

Cream stock, a finely crimped glued edge, inset ink rules, Newsreader titles, subtle grain, and the existing story plates make a family shelf. Gold appears only in the single “This morning” mark. Missing art keeps a typographic face. Existing fonts are unchanged.

Link names are `Open <title without trailing period>, <Weekday D Month YYYY>`. Plate images are decorative. Grade metadata comes only from each day’s `pack.json`; missing or invalid grades are omitted. Focus outlines remain outside the clipped inner paper, and reduced motion disables transforms and transitions.

`src/archive-render.mjs`, `src/archive.css`, and `src/archive.js` own the landing chrome; `scripts/render-archive.mjs` applies it to both archive URLs. Day and today artifacts remain unchanged. The noindex setting and family dogfood footer remain.

Checks: `npm run format:check`, `npm run archive`, `npm test`, and `npm run test:browser`. The Chromium and WebKit suite covers one-click/tap navigation, keyboard and focus, reduced motion, JavaScript disabled, and 320/390/820/1440px layouts. Run `npx playwright install chromium webkit` first; screenshots go to `output/archive-qa/` or `ARCHIVE_QA_DIR`.
