# Wonder Daily — generators split ship

Task: `wd-generators-split-ship`. **Draft PR. Do not merge.**

Public repo stays the view/display layer so [GitHub Pages](https://kbo4sho.github.io/daily-learning-pack/) and [`/today/`](https://kbo4sho.github.io/daily-learning-pack/today/) keep working on the free public Actions/Pages plan. Generators move to a free-tier **private** repo (private Pages would need GitHub Pro; we do not use that).

## Private repo

**https://github.com/kbo4sho/daily-learning-generators** (private)

Created under `kbo4sho`. `gh repo create` failed (`Resource not accessible by integration` for the cloud-agent token). GitHub MCP `create_repository` as kbo4sho succeeded. The same cloud-agent `gh` token cannot clone or push that new private repo, so the first private commit is an import workflow plus overlay; the repo’s own `GITHUB_TOKEN` copies generator paths (including binary plates) from public `eeb5ce0`.

## Paths moved (private source of truth)

| Path                                                                                                                     | Why                                                 |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| `scripts/build.mjs`, `build-site.mjs`, `build-archive.mjs`                                                               | Site / PDF / archive generate                       |
| `scripts/author-curiosity-pack.mjs`, `overnight-curiosity.mjs`, `intake-theme.mjs`, `editorial-curiosity-pass.mjs`       | Overnight author path                               |
| `scripts/serve.mjs`                                                                                                      | Preview (copy remains public for committed `dist/`) |
| `src/pack.mjs`, `archive.mjs`, `archive-render.mjs`, `curiosity-render.mjs`, `render.mjs`, `site-assets.mjs`, `html.mjs` | Build-only Node                                     |
| `src/*.js`, `src/*.css`                                                                                                  | Compiled into `dist/` by the private build          |
| `tests/overnight.test.mjs`, `curiosity.test.mjs`, `pack.test.mjs`, `archive.test.mjs`, `inquiry-build.mjs`               | Generator tests                                     |
| `queue/`, `archive/approved.json`, `packs/`, `assets/`, `docs/overnight.md`                                              | Author/overnight/registry                           |

Public leftovers: thin `scripts/moved.mjs` stubs, `scripts/serve.mjs`, `tests/view.test.mjs`, committed `dist/`, stills, DESIGN.md.

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

| What                  | URL                                                  |
| --------------------- | ---------------------------------------------------- |
| Private generators    | https://github.com/kbo4sho/daily-learning-generators |
| Public view (this PR) | (see the draft PR on this branch)                    |
| Live Pages            | https://kbo4sho.github.io/daily-learning-pack/       |
| Live today            | https://kbo4sho.github.io/daily-learning-pack/today/ |
