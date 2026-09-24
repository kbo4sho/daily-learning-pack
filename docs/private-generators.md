# Private generators (captain)

Display-only public repo. Generators: **https://github.com/kbo4sho/daily-learning-generators** (private, free tier).

## After cloning the private repo

Generator source is already on that repo. Seed plate binaries, then build:

```sh
node scripts/seed-assets-from-public.mjs   # curiosity-bean plates from public eeb5ce0
npm ci
npx playwright install chromium
npm run site
npm test
```

Recovery overlay (safe to re-run; does not overwrite private README / package.json / sync scripts):

```sh
bash scripts/bootstrap-from-public.sh
```

Copy `docs/github-workflows/*.yml` → `.github/workflows/`.

## Secret

Fine-grained PAT, free, no GitHub Pro:

1. https://github.com/settings/personal-access-tokens
2. Owner `kbo4sho`; only repository `daily-learning-pack`
3. Contents read/write, Pull requests read/write
4. Private repo secret name: **`PUBLIC_VIEW_PUSH_TOKEN`**

Then run **Sync built view to public pack**. It opens a **draft** PR here. No auto-merge.

Manual fallback: private `scripts/sync-to-public.md`.

After a dist sync lands here, `npm run archive` reapplies **public** landing chrome (`src/archive-render.mjs`, `src/archive.css`) so archive restyles stay in this view repo.
