# Private generators (captain)

Display-only public repo. Generators: **https://github.com/kbo4sho/daily-learning-generators** (private, free tier).

## After cloning the private repo

```sh
bash scripts/bootstrap-from-public.sh
node scripts/seed-assets-from-public.mjs
npm ci
npx playwright install chromium
npm run site
npm test
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
