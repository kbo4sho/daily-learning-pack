# Wonder Daily — archive seed packets

Task: `wd-archive-seed-packets-ship`. **Draft PR. Do not merge.** No craft-approve yet.

Public view restyle only. Rebased onto public `main` tip `337206438dba832755e2aaaf557560dea2c87efc` (generators-split #10). No generators returned to this repo.

## PR

Draft: **https://github.com/kbo4sho/daily-learning-pack/pull/11**

## Craft decisions

- **Not a stacked deck, not a SaaS card grid.** Approved days stand in an `auto-fill` shelf of 248px packets. A single morning stays packet-sized and left-aligned; it does not stretch into a banner.
- **Packet silhouette.** Manila packet paper (`#f3ead4`) on cream page so the object reads. Tapered flap (`clip-path`) plus `filter: drop-shadow` (box-shadow does not follow the taper). Kraft flap, tear strip at the top, inset plate window, gold-edged shelf board. Gold is lot stamp + shelf hairlines only.
- **That day’s still.** Face comes only through `faceFromPack`, using `dist/days/{slug}/pack.json` `reading.coverPlate` / first plate. Archive-row declared image fields are ignored. Remote URLs and `..` paths are rejected. Missing art fails to a sage typographic face of the title — never lorem or stock. Root `pack.json` / `assets/` are gone; packets do not read them.
- **Copy.** Killed “quiet paper, quiet ink.” House bar: “For this family. Grade 2.” Shelf: “On the shelf.” Footer keeps the house line and the dogfood / no-marketing note.
- **Packet ritual.** The door packet and shelf packets are the three-press ritual controls. Each packet keeps an always-visible direct link (“Open this morning” / dated equivalent) with a real destination. Ritual-only step chrome stays hidden until `archive.js` successfully enhances the page, so the no-JS packet remains an ordinary link.
- **Motion.** Motion users keep the three-press sealed → flap-lifted → seal-torn ritual, the 8px hover/focus lift, and the always-visible direct link. Under `prefers-reduced-motion: reduce`, the manila packet remains visible as the primary one-tap Open link; the step label, polite live region, tear strip, and ritual transforms are suppressed. The existing explicit text link remains as a redundant direct-open affordance. The unenhanced/no-JS packet also keeps a truthful direct-open label, while `packet-ritual-ready` still gates step chrome until JavaScript boots.
- **Fonts.** Packet CSS uses vendored `src/fonts/` (Newsreader + Inter). `npm run archive` copies them to `dist/fonts` and `dist/archive/fonts`.
- **No Astra.** Existing day plates were enough.

## Fail-closed latest

`archivePage` throws unless `latest` is passed. `renderArchive` throws if `archive.json.latest` is missing or not in `days[]`. No `entries[0]` / `home[0]` fallback.

## Split review-fix contracts kept

- Single `dist/archive.json` (nested `dist/archive/archive.json` stripped)
- Unused root day runtime removed
- Mirrored `dist/archive/archive.css` + `dist/archive/fonts` left as the split has them (open captain question)
- View tests are structural (no dogfood copy pins)
- Private-generator captain notes stay as landed on `main` (bootstrap is recovery-only)

## Verify

```sh
npm ci
npm run archive
npm test
npm run preview   # http://127.0.0.1:4173/daily-learning-pack/
```

Live must keep working after #10 + this land: [archive](https://kbo4sho.github.io/daily-learning-pack/) and [`/today/`](https://kbo4sho.github.io/daily-learning-pack/today/).
