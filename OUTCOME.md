# Wonder Daily — archive seed packets

Task: `wd-archive-seed-packets-ship`. **Draft PR. Do not merge.**

Public view restyle only. Rebased onto public `main` after generators-split (#10) landed. No generators returned to this repo.

## PR

Draft: **https://github.com/kbo4sho/daily-learning-pack/pull/11**

## Craft decisions

- **Not a stacked deck, not a SaaS card grid.** Approved days stand in an `auto-fill` shelf of 236px packets. A single morning stays packet-sized and left-aligned; it does not stretch into a banner.
- **Packet silhouette.** Tapered flap (`clip-path`) plus `filter: drop-shadow` so the cut shape actually reads (box-shadow does not follow the taper). Tear strip at the top. Plate sits in an inset window. Packets stand on a gold-edged shelf board. Gold is lot stamp + shelf hairlines only.
- **That day’s still.** Face comes from the archive row’s image fields if present, else `dist/days/{slug}/pack.json` `reading.coverPlate` / first plate. Remote URLs and `..` paths are rejected. Missing art fails to a sage typographic face of the title — never lorem or stock.
- **Copy.** Killed “quiet paper, quiet ink.” House bar: “For this family. Grade 2.” Shelf: “On the shelf.” Footer keeps the house line and the dogfood / no-marketing note.
- **Leo door stays one tap.** Large type + `./today/` button. The standing packet on the right is the same morning’s plate, decorative. Shelf packet links to the day URL.
- **Motion.** Hover/focus lifts 7px. `prefers-reduced-motion` drops the lift and all transitions.
- **No Astra.** Existing day plates were enough.

## Fail-closed latest

`archivePage` throws unless `latest` is passed. `renderArchive` throws if `archive.json.latest` is missing or not in `days[]`. No `entries[0]` / `home[0]` fallback.

## Invariants kept

`noindex, nofollow`. Leo `/today/` door. No Wonder Together marketing nav. `dist/archive.json` still has the one real approved day. `npm run build` / `site` / `overnight` remain private-repo stubs.

## Verify

```sh
npm ci
npm run archive
npm test
npm run preview   # http://127.0.0.1:4173/daily-learning-pack/
```

Live must keep working after #10 + this land: [archive](https://kbo4sho.github.io/daily-learning-pack/) and [`/today/`](https://kbo4sho.github.io/daily-learning-pack/today/).
