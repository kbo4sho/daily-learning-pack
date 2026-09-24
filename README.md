# Daily Learning Pack (public view)

**Display-only** Wonder Daily archive for **2nd grade (roughly ages 7–8)**. This repository hosts committed static files. Families open a morning on GitHub Pages; they do not run generators here.

Live:

- Archive landing: [https://kbo4sho.github.io/daily-learning-pack/](https://kbo4sho.github.io/daily-learning-pack/)
- Today (Leo’s one tap): [https://kbo4sho.github.io/daily-learning-pack/today/](https://kbo4sho.github.io/daily-learning-pack/today/)

Wonder Daily stays a parent-led family surface. It is **not** on public Wonder Together marketing navigation.

![The sample math lesson at an iPad-sized viewport](docs/stills/ipad-math.png)

## Generators live in a private repo

Authoring, overnight, archive build, Playwright PDF generation, and pack source of truth are in the private repo **[kbo4sho/daily-learning-generators](https://github.com/kbo4sho/daily-learning-generators)** (free-tier private; not public).

`npm run build`, `generate`, `site`, `overnight`, and `author` in this tree exit with a pointer to that repo.

## How the public site is updated

1. Private generators run `npm run site` (archive at `dist/index.html`, latest approved pack at `dist/today/`).
2. Private Actions **Sync built view to public pack** (or the manual steps in that repo’s `scripts/sync-to-public.md`) opens a **draft** PR here that updates committed `dist/`.
3. A human merges. **No auto-merge.**
4. GitHub Pages on `main` deploys `dist/` as-is. It does **not** run `npm run site`.

Captain must store a fine-grained PAT named `PUBLIC_VIEW_PUSH_TOKEN` on the **private** repo (Contents + Pull requests on this public repo only). This view repo does not hold that secret.

## Preview committed artifacts

Requires **Node.js 22+**. No Playwright, fonts toolchain, or pack authoring.

```sh
npm ci
npm test
npm run preview
```

Open [http://127.0.0.1:4173/daily-learning-pack/](http://127.0.0.1:4173/daily-learning-pack/). For an iPad on the same Wi-Fi: `HOST=0.0.0.0 npm run preview`.

## GitHub Pages

Workflow: `.github/workflows/pages.yml`. On push to `main` (and manual **workflow_dispatch**), it checks that `dist/index.html` and `dist/today/index.html` exist, uploads `dist/`, and deploys. No `npm run site`, no Chromium.

Expected URL: [https://kbo4sho.github.io/daily-learning-pack/](https://kbo4sho.github.io/daily-learning-pack/).

If Vercel project **wonder-daily** still points at this repo, it must serve committed `dist/` the same way (`vercel.json` does not install Playwright or generate).

## What you are looking at

The seeded view is the approved **curiosity bean** morning (_A bean becomes._) plus the archive landing. Reading, math, and writing stay on the pack pages under `/today/` and `/days/curiosity-bean/`. Print PDFs are in each day’s `pdf/` folder when the private build included them.

No accounts, backend, tracking, external font requests, or runtime AI. Digital writing stays in memory and is not submitted.

## Design

Runtime CSS in `dist/` is canonical for the published site. Product notes: [DESIGN.md](DESIGN.md). Split notes: [OUTCOME.md](OUTCOME.md).
