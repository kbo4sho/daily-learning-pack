const repo = "https://github.com/kbo4sho/daily-learning-generators";
console.error(`Wonder Daily generators live in the private repo:
  ${repo}

This public repository is the view/display layer. It ships committed
static files under dist/ and does not run site, author, or overnight builds.

Captain: clone the private generators repo, then npm run site / overnight.
Sync built output back with the private workflow or scripts/sync-to-public.md.
`);
process.exit(1);
