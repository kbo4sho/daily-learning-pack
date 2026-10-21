import { esc } from "./html.mjs";

/** Illustrated scenes shipped with the page (src/welcome-assets/img). */
export const WELCOME_ART = {
  hero: ["hero-800.webp 800w, hero-1600.webp 1600w", "hero-1600.webp"],
  doorBig: [
    "door-big-480.webp 480w, door-big-960.webp 960w",
    "door-big-960.webp",
  ],
  doorLittle: [
    "door-little-480.webp 480w, door-little-960.webp 960w",
    "door-little-960.webp",
  ],
  stepPick: [
    "step-pick-480.webp 480w, step-pick-960.webp 960w",
    "step-pick-960.webp",
  ],
  stepRead: [
    "step-read-480.webp 480w, step-read-960.webp 960w",
    "step-read-960.webp",
  ],
  stepNote: [
    "step-note-480.webp 480w, step-note-960.webp 960w",
    "step-note-960.webp",
  ],
};

const pic = ([srcset, src], { alt = "", sizes, w, h, cls = "", lazy = true }) =>
  `<img class="${cls}" src="./img/${src}" srcset="${srcset
    .split(", ")
    .map((s) => `./img/${s}`)
    .join(
      ", ",
    )}" sizes="${sizes}" alt="${esc(alt)}" width="${w}" height="${h}"${
    lazy ? ' loading="lazy" decoding="async"' : ""
  }>`;

/** Hand-drawn wobble rule, reused under headings and between steps. */
const squiggle = `<svg class="w-squiggle" viewBox="0 0 160 12" aria-hidden="true" focusable="false"><path d="M2 7c14-6 24 4 38 0s24-6 38-1 24 5 38 0 24-5 40 1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;

/**
 * Hidden parent welcome page (dist/welcome/). Not linked from any nav,
 * noindex. Name-free: copy speaks of "your kids" and the Big/Little
 * Wonderer characters only. `tonight` is the latest archive day with its
 * resolved story plate (face may be null; the card falls back to type).
 */
// TODO(next step): the Start email capture below is a placeholder. It is not
// wired to any service and sends nothing. Wire it to a real signup endpoint.
export function welcomePage({ tonight }) {
  if (!tonight?.title) throw new Error("welcomePage requires tonight's day.");
  const face = tonight.face?.src
    ? `<img class="w-pack-art" src="${esc(tonight.face.src)}" alt="${esc(tonight.face.alt)}" width="1536" height="1024" decoding="async">`
    : "";
  const door = (art, name, line, cls) => `
        <figure class="w-door ${cls}">
          <div class="w-door-frame">${pic(art, { sizes: "(min-width: 900px) 300px, 44vw", w: 960, h: 1200 })}</div>
          <figcaption><span class="w-door-name">${esc(name)}</span><span class="w-door-line">${esc(line)}</span></figcaption>
        </figure>`;
  const step = (n, art, title, body, alt) => `
      <li class="w-step">
        <div class="w-step-art">${pic(art, { alt, sizes: "(min-width: 900px) 320px, 86vw", w: 960, h: 960 })}</div>
        <p class="w-step-num" aria-hidden="true">${n}</p>
        <h3>${title}</h3>
        <p>${body}</p>
      </li>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#F7F3EB">
<title>Wonder Daily · A softer goodnight</title>
<link rel="preload" href="./fonts/newsreader-latin-variable.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="./welcome.css">
</head>
<body>
<header class="w-top">
  <p class="w-brand">Wonder Together<span>Wonder Daily</span></p>
  <p class="w-top-note">For tonight</p>
</header>
<main>
  <section class="w-hero" aria-labelledby="w-hero-title">
    <div class="w-hero-scene">
      ${pic(WELCOME_ART.hero, { alt: "Big Wonderer and Little Wonderer curled up in a window nook at dusk, reading a picture book by lamplight under a crescent moon.", sizes: "(min-width: 900px) 62vw, 100vw", w: 1600, h: 1067, cls: "w-hero-img", lazy: false })}
    </div>
    <div class="w-hero-copy">
      <p class="w-kicker">A parent’s practice · A moment together</p>
      <h1 id="w-hero-title">A little wonder.<br><em>A softer goodnight.</em></h1>
      <p class="w-lede">A nightly story, a why, and activities to share. You read and lead. We bring the pack.</p>
      <a class="w-start" href="#start">Start <span aria-hidden="true">→</span></a>
    </div>
    <article class="w-pack" aria-label="Tonight’s pack">
      <p class="w-pack-label">Tonight’s pack <span>read it once, together</span></p>
      <div class="w-pack-window">${face}</div>
      <h2>${esc(tonight.title)}</h2>
      <p class="w-pack-teaser">${esc(tonight.teaser || "")}</p>
      <ul class="w-pack-parts"><li>Story</li><li>A why</li><li>Activities</li><li>PDFs</li></ul>
    </article>
  </section>

  <section class="w-doors" aria-labelledby="w-doors-title">
    <p class="w-kicker">Their own way in · Your time together</p>
    <h2 id="w-doors-title">One family page.<br><em>A door for each kid.</em></h2>
    ${squiggle}
    <p class="w-lede">Nightly stories and activities for your family. Each kid has a door, and you are beside them at every one.</p>
    <div class="w-family">
      <p class="w-family-label">Your family page <span>a shared place for little wonderers</span></p>
      <div class="w-door-row">${door(WELCOME_ART.doorBig, "Big Wonderer’s door", "Longer whys, bigger builds.", "is-big")}${door(WELCOME_ART.doorLittle, "Little Wonderer’s door", "Picture-first, read aloud.", "is-little")}
      </div>
      <p class="w-family-foot">Behind every door, a nightly pack: a story, a why, activities, and PDFs to print.</p>
    </div>
  </section>

  <section class="w-how" aria-labelledby="w-how-title">
    <p class="w-kicker">How a night works</p>
    <h2 id="w-how-title">A little choice.<br><em>A night of wonder.</em></h2>
    ${squiggle}
    <ol class="w-steps">${step("i.", WELCOME_ART.stepPick, "They pick tomorrow.", "Three curious ideas on the table. Your kid chooses what tomorrow wonders about.", "Little Wonderer choosing between a moon pebble, a snail shell and a tiny raincloud in a jar while Big Wonderer watches.")}${step("ii.", WELCOME_ART.stepRead, "Read tonight’s pack.", "A story, a why, and a few activities. You read and lead; it takes about twenty minutes.", "Big Wonderer and Little Wonderer reading a printed booklet together on a bed under lamplight.")}${step("iii.", WELCOME_ART.stepNote, "A note for you.", "After lights out, a short parent note arrives by email. A quiet moment that is just yours.", "Big Wonderer alone at a kitchen table with a cup of tea, reading a small folded note.")}
    </ol>
  </section>

  <section class="w-cta" id="start" aria-labelledby="w-cta-title">
    <div>
      <p class="w-kicker">Start</p>
      <h2 id="w-cta-title"><em>Their curiosity.</em><br>Your company.</h2>
    </div>
    <form class="w-form" data-stub="email-capture" action="#start" onsubmit="return false" novalidate>
      <label for="w-email">Where should tonight’s note go?</label>
      <div class="w-form-row">
        <input id="w-email" name="email" type="email" autocomplete="email" placeholder="you@example.com">
        <button type="submit" disabled aria-describedby="w-form-note">Start</button>
      </div>
      <p id="w-form-note" class="w-form-note">Coming soon. Sign-up isn’t open yet, and nothing you type here is sent.</p>
    </form>
  </section>
</main>
<footer class="w-foot"><p><em>Nothing to catch up on.</em></p><p>Wonder Daily · from Wonder Together</p></footer>
</body>
</html>
`;
}
