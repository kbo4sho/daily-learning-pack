# Wonder Daily · archive and overnight

Captain-authorized ship for a public archive landing plus a nightly curiosity scaffold. Wonder Daily stays a parent-led family surface. It is not added to public Wonder Together marketing navigation.

## Live URL (after merge + promote)

Preferred host is the existing Vercel project **wonder-daily**. This PR does not force a production promote.

| Surface                              | Path                                           | When it exists                       |
| ------------------------------------ | ---------------------------------------------- | ------------------------------------ |
| Archive landing (Leo’s morning door) | `/` on the public site, and always `/archive/` | After `npm run site` or any generate |
| Latest approved pack (one tap)       | `/today/`                                      | After generate/site                  |
| A specific approved day              | `/days/<slug>/`                                | After generate/site                  |
| Machine list                         | `/archive.json`                                | After generate/site                  |

**Vercel (preferred).** Project name: `wonder-daily`. `vercel.json` builds `npm run site` into `dist/`. Opening this PR should create a **preview** if the project is linked to `kbo4sho/daily-learning-pack`. Do not treat preview as production.

After a human merges to `main`:

1. If the Vercel project auto-deploys `main`, production updates to the archive + latest approved pack.
2. If it does not auto-promote, use the Vercel dashboard: promote the `main` deployment (or the reviewed preview) to Production. Do not force-production from an unreviewed preview.
3. Expected production shape: `https://wonder-daily.vercel.app/` (confirm the project’s production domain in the dashboard). Leo opens `/` or `/today/`.

**GitHub Pages (fallback).** Manual only. After merge, run **Actions → Publish learning pack to Pages** on `main`. The workflow now runs `npm run site`, so the published root is the archive. Expected URL: [https://kbo4sho.github.io/daily-learning-pack/](https://kbo4sho.github.io/daily-learning-pack/). Archive also lives at `/daily-learning-pack/archive/`. A private repo needs a plan that supports private Pages. Nothing is published merely because this PR exists.

Local preview after `npm run generate -- "curiosity bean"` or `npm run site`:

```sh
npm run preview
```

- Generate (CI default): pack at [http://127.0.0.1:4173/daily-learning-pack/](http://127.0.0.1:4173/daily-learning-pack/), archive at `/daily-learning-pack/archive/`, Leo at `/daily-learning-pack/today/`
- Site (public landing): archive at `/daily-learning-pack/`, Leo at `/daily-learning-pack/today/`

## What is approved vs preview

`archive/approved.json` is the live registry. Only captain craft-approved packs get a row. Seeded with **curiosity-bean** (2026-09-23 dogfood).

Unapproved overnight drafts stay on the draft PR / Vercel preview. They are not added to the registry and must not be merged as “today.”

## Fire overnight

The 7:45pm CT theme ping is a **separate Firstmate routine**. It writes the captain’s reply to `queue/next-topic.txt`. This repo does not send that ping.

```sh
# Optional: Firstmate already stored tomorrow’s theme
# echo "morning dew" > queue/next-topic.txt

npm run overnight
```

Sequence the script prints (and enforces as far as files allow):

1. **Intake** — `queue/next-topic.txt` if it has a theme; otherwise `queue/standby.json`.
2. **Author** — `scripts/author-curiosity-pack.mjs` writes `packs/<slug>.json` at the Curiosity bar (6 scenic plate slots). No API key → high-quality stub + TODOs. Never inquiry-only.
3. **Editorial gate** — no tip-hand labels; story spreads are image + moment; no per-segment H2 on Letter or fold.
4. **Writing-quality gate** — interesting vocab, fresh phrasing for Leo.
5. **Generate** — `npm run generate -- "<topic>"` only if plates exist on disk. Brick Astra plate-gen is stubbed; missing art skips generate on purpose.
6. **Draft PR** — open a draft, let CI run, **ping Firstmate for captain craft-approve**. Do not auto-merge.

Manual generate of the current dogfood day still works:

```sh
npm run generate -- "curiosity bean"
npm test
npm run site    # public landing at dist/index.html
```

## Approve path (Firstmate)

1. Review the draft PR (editorial + writing + plates).
2. Ask the captain for **craft-approve**.
3. On approve, a human merges. No bot merge.
4. Add a row to `archive/approved.json` (slug, date, topic, teaser).
5. Production promote (Vercel `main`, or manual Pages) publishes **today**.
6. The archive gains that row. Leo’s morning URL is the latest approved pack (`/today/`).
7. Anything not in the registry stays preview-only.

## Plate gen

Default pack schema expects **6 unique scenic plates**. `curiosity-bean` remains the shipped 4-plate dogfood edition. Overnight stubs reserve six slots under `assets/<slug>/`. Brick Astra fills them later; empty art must not block this landing PR.
