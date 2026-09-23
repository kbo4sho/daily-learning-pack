---
version: alpha
colors:
  paper: '#f8f5ee'
  surface: '#fffdf8'
  ink: '#293b35'
  muted: '#59645d'
  line: '#d6d8cc'
  sage: '#e9eddf'
  gold: '#a7864a'
typography:
  body:
    fontFamily: 'Inter, Arial, sans-serif'
  story:
    fontFamily: 'Newsreader, Georgia, serif'
rounded:
  control: '4px'
spacing:
  small: '8px'
  medium: '16px'
  large: '32px'
components:
  primary-button:
    height: '48px'
    backgroundColor: 'ink'
    textColor: 'surface'
---

# Wonder Daily · Curiosity-led mock

## Overview

Product register: a parent-led Grade 2 family day on a shared phone or iPad, in English. Private dogfood only. The brief for `wd-curiosity-led-mock` is authoritative: theme → four questions → generated single-scene Curiosity plates → reading, math, writing. The same windowsill and Pebble Guides make each return familiar. The signature is the illustrated window into a bean's quiet growth, not decorative UI.

Four choices locked for this mock: images lead before tasks; orange belongs inside mechanism illustrations; reading is one beat per screen with an opacity-only entrance; a small book carries the identical story onto paper. No score, urgency, public WT link, account, or runtime AI.

## Colors

Runtime CSS is canonical (Model B). `src/curiosity.css :root` owns each `colors.<name>` above as `--<name>`, consumed by the new day only. Paper/surface carry warmth, ink handles text and CTAs, muted handles notes, line handles structure, sage marks the selected question. Gold is available as an inherited brand role but unused in this mock's chrome. The illustration's orange annotations are baked into the art, never action colors.

## Typography

`typography.body` → `--font-body` and `typography.story` → `--font-story` in curiosity.css. Local Newsreader 400 and Inter 400/600 WOFF2. Editorial titles and read-aloud passages use Newsreader; controls, directions and measurements use Inter. PDF zine uses embedded standard Times/Helvetica, as PR #37 does, to keep the small client generator portable; worksheets use local brand fonts.

## Layout

8px rhythm, 1440px maximum shell, 48/32/20px desktop/tablet/phone margins. Questions beside the first plate on wide screens; questions before the plate on phones. Images preserve their 3:2 frame without cropping. Reading has fewer words and larger imagery, one beat visible. Natural document scrolling preserves enlarged text and expanded instructions; no fixed viewport clipping. Still worksheets are three portrait Letter pages; fold book is one landscape Letter sheet.

## Elevation & Depth

Flat paper, thin rules, no decorative shadow or floating cards. Image detail supplies depth.

## Shapes

4px controls, simple rules, no badge clusters. Full scenic rectangular plates preserve the explanation.

## Components

| Capability | Canonical owner | Source / variant | Verification |
| --- | --- | --- | --- |
| Family reader | `src/reader.js` | Existing inchworm/Practices behavior, new plate markup in curiosity-render; no pose/morph for this still story | reader tests and curiosity browser matrix |
| Day navigation | `src/curiosity.js` | Explicit curiosity-first variant; links retain no-JS anchors, parent-led order from brief | keyboard, focus and retention checks |
| Shared scene chooser | `sceneChooser` in curiosity.js | Questions and writing scenes share current-state semantics | browser checks |
| Print worksheets | `scripts/build.mjs`, `src/render.mjs` | Existing PDF pipeline and overflow guard; curiosityWorksheet variant | Letter/page counts and grayscale review |
| Fold download | `src/zine.js` | PR #37 imposition; pack owns beats/plate IDs | structural PDF, browser failure/retry, visual review |
| Plain writing field | Native textarea | No validation/submission. In-memory only; auto-grow and exit guard | draft retention and 200% text |
| Disclosure / feedback | Native details; inline role=status | No overlays or toasts needed | keyboard, accessibility and failure check |
| Scrollbar | curiosity.css root | Standard visible thumb/track, stable gutter; system forced colors | browser |

The original engines/fair-sharing palette remains in styles.css, and inchworms remains in inchworms.css. This branch adds a named Curiosity mock variant rather than changing earlier packs. The one shared reader change makes quiz-feedback reset optional for a story without a quiz. No maintained UI primitive is duplicated.

## Do's and Don'ts

Do leave an explanation optional until the family has looked. Do keep every learning task visibly attached to an image. Do provide descriptive image alternatives, visible focus, native links/buttons, reduced-motion stillness, and a usable no-JS reading order. Do state that numbers are pretend and illustrations are enlarged/simplified. Don't make children count tiny painted details as exact data. Don't crop arrows, turn the guides into bears or toys, add confetti, or expose this in public navigation.
