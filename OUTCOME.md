# Wonder Daily — generators split ship

Task: `wd-generators-split-ship`. **Draft PR. Do not merge.**

Public repo stays the view/display layer so [GitHub Pages](https://kbo4sho.github.io/daily-learning-pack/) and [`/today/`](https://kbo4sho.github.io/daily-learning-pack/today/) keep working on the free public Actions/Pages plan. Generators move to a free-tier **private** repo (private Pages would need GitHub Pro; we do not use that).

## Private repo

**https://github.com/kbo4sho/daily-learning-generators** (private)

Created under `kbo4sho`. `gh repo create` failed (`Resource not accessible by integration` for the cloud-agent token). GitHub MCP `create_repository` as kbo4sho succeeded. The cloud-agent `gh` token cannot clone or push the new private repo. Files were added via the GitHub MCP Contents API. **`.github/workflows/*` cannot be written** (API 404 without the `workflow` scope). YAML lives in the private repo at `docs/github-workflows/` for the captain to copy.

Full generator source (scripts/src/tests/packs/assets) is restored on a captain machine with:

```sh
bash scripts/bootstrap-from-public.sh   # copies from public eeb5ce0
node scripts/seed-assets-from-public.mjs
```

Those commands are also the first steps of the documented private CI workflows.

## Paths moved (private source of truth)

| Path                                                                                                               | Why                                                 |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| `scripts/build.mjs`, `build-site.mjs`, `build-archive.mjs`                                                         | Site / PDF / archive generate                       |
| `scripts/author-curiosity-pack.mjs`, `overnight-curiosity.mjs`, `intake-theme.mjs`, `editorial-curiosity-pass.mjs` | Overnight author path                               |
| `scripts/serve.mjs`                                                                                                | Preview (copy remains public for committed `dist/`) |
| `src/pack.mjs`, `archive.mjs`, `curiosity-render.mjs`, `render.mjs`, `site-assets.mjs`                             | Build-only Node (private)                           |
| Kid-day `src/*.js` / subject CSS                                                                                   | Compiled into `dist/` by the private build          |
| `tests/overnight.test.mjs`, `curiosity.test.mjs`, `pack.test.mjs`, `archive.test.mjs`, `inquiry-build.mjs`         | Generator tests                                     |
| `queue/`, `archive/approved.json`, `packs/`, `assets/`, `docs/overnight.md`                                        | Author/overnight/registry                           |

Public leftovers: thin `scripts/moved.mjs` stubs, `scripts/serve.mjs`, `scripts/render-archive.mjs`, **archive chrome source** (`src/archive-render.mjs`, `src/archive.css`, `src/html.mjs`), `tests/view.test.mjs`, committed `dist/`, stills, DESIGN.md.

## Public paths that own archive markup/CSS

For follow-on **`wd-archive-seed-packets-ship`** (seed-packet cards; no generator work). Visual design was **not** changed in this split.

| Public path                  | Role                                                                                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `src/archive-render.mjs`     | **Landing HTML template** (`archivePage`, Leo door, approved-morning rows). Edit this for card markup.                                   |
| `src/archive.css`            | **Landing / card chrome CSS** (copied to `dist/archive.css` and `dist/archive/archive.css`).                                             |
| `src/html.mjs`               | HTML escaping used by the landing template.                                                                                              |
| `scripts/render-archive.mjs` | Thin view rebuild: reads `dist/archive.json`, writes `dist/index.html` + `dist/archive/index.html`, copies CSS. No Playwright, no packs. |
| `dist/index.html`            | Root archive landing (generated from the public template).                                                                               |
| `dist/archive/index.html`    | Nested `/archive/` copy of the same chrome.                                                                                              |
| `dist/archive.json`          | **Data only** (from private `npm run site` / sync). Do not put card layout here.                                                         |

`npm run archive` reapplies public chrome after a private dist sync so seed-packet edits are not locked inside `daily-learning-generators`. Pages and `check.yml` run that script. Private generators may still emit a landing for local preview; **public `src/archive-*` is the Pages source of truth.**

## Connection design

Preferred: private Actions workflow **Sync built view to public pack** builds `npm run site`, then `scripts/sync-to-public.mjs` opens a **draft** PR on this repo updating `dist/`. **No auto-merge.**

**Captain secret still needed:** fine-grained PAT stored as `PUBLIC_VIEW_PUSH_TOKEN` on the _private_ repo (Contents + Pull requests on `daily-learning-pack` only). Exact steps: private README and `scripts/sync-to-public.md`. This agent cannot create that token.

Manual fallback: copy `dist/` from a private `npm run site` onto a branch here and open a draft PR.

## Public Pages

`.github/workflows/pages.yml` uploads committed `dist/` (checks `index.html` + `today/index.html`). No Playwright, no `npm run site`. Push to `main` or `workflow_dispatch`.

Seeded `dist/` is the archive landing + curiosity-bean `/today/` from `npm run site` at the split.

## Tests

- Combined tree before slim: `npm test` **28/28**.
- Public view tree: `npm test` (committed artifact + stub checks).
- Private tree: `npm test` after import (same generator suite).

## Product invariants kept

No inquiry-only overnight path; no auto-merge; archive slug safety; `WD_REQUIRE_CURIOSITY` on the site path; no API key names in pack JSON; no Wonder Together marketing nav.

## URLs

| What                  | URL                                                    |
| --------------------- | ------------------------------------------------------ |
| Private generators    | https://github.com/kbo4sho/daily-learning-generators   |
| Public view (this PR) | https://github.com/kbo4sho/daily-learning-pack/pull/10 |
| Live Pages            | https://kbo4sho.github.io/daily-learning-pack/         |
| Live today            | https://kbo4sho.github.io/daily-learning-pack/today/   |
