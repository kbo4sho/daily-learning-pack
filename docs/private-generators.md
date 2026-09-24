# Private generators (captain)

Display-only public repo. Generators: **https://github.com/kbo4sho/daily-learning-generators** (private, free tier).

## After cloning the private repo

Generator source is already on that repo. Healthy checkout — no bootstrap:

```sh
npm ci
npx playwright install --with-deps chromium
node scripts/seed-assets-from-public.mjs   # curiosity-bean plates from public eeb5ce0
npm run site
npm test
```

Private check/sync CI uses that same path. It does **not** run bootstrap.

## Recovery only (empty or broken local clone)

`bash scripts/bootstrap-from-public.sh` overlays generator source from public `eeb5ce0` when a local clone is empty or broken. It does not overwrite private README / package.json / PATHS / OUTCOME / sync / seed scripts.

**LOCKED — recovery only.** Do not add `bootstrap-from-public.sh` to `check.yml` or `sync-public-view.yml` when copying YAML into `.github/workflows/`.

Copy `docs/github-workflows/*.yml` → `.github/workflows/` as published (no bootstrap step).

## Secret

Fine-grained PAT, free, no GitHub Pro:

1. https://github.com/settings/personal-access-tokens
2. Owner `kbo4sho`; only repository `daily-learning-pack`
3. Contents read/write, Pull requests read/write
4. Private repo secret name: **`PUBLIC_VIEW_PUSH_TOKEN`**

Then run **Sync built view to public pack**. It opens a **draft** PR here. No auto-merge.

Manual fallback: private `scripts/sync-to-public.md`.

After a dist sync lands here, `npm run archive` reapplies **public** landing chrome (`src/archive-render.mjs`, `src/archive.css`) so archive restyles stay in this view repo.
