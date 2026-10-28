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
  `<img${cls ? ` class="${cls}"` : ""} src="./img/${src}" srcset="${srcset
    .split(", ")
    .map((s) => `./img/${s}`)
    .join(
      ", ",
    )}" sizes="${sizes}" alt="${esc(alt)}" width="${w}" height="${h}"${
    lazy ? ' loading="lazy" decoding="async"' : ' fetchpriority="high"'
  }>`;

/** Hand-drawn wobble rule, reused under headings and between steps. */
const squiggle = `<svg class="w-squiggle" viewBox="0 0 160 12" aria-hidden="true" focusable="false"><path d="M2 7c14-6 24 4 38 0s24-6 38-1 24 5 38 0 24-5 40 1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;

/**
 * Hidden parent welcome page (dist/welcome/). Not linked from any nav,
 * noindex. Name-free: copy speaks of "your child" and the Big/Little
 * Wonderer characters only. `tonight` is the latest archive day with its
 * resolved story plate (face may be null; the card falls back to type).
 */
// TODO(next step): the Start email capture below is a placeholder. It is not
// wired to any service and sends nothing. Wire it to a real signup endpoint.
export function welcomePage({ tonight }) {
  if (!tonight?.title) throw new Error("welcomePage requires tonight's day.");
  const face = tonight.face?.src
    ? `<img class="w-pack-art" src="${esc(tonight.face.src)}"${
        tonight.face.srcset
          ? ` srcset="${esc(tonight.face.srcset)}" sizes="(min-width: 900px) 420px, (min-width: 700px) 38vw, calc(100vw - 72px)"`
          : ""
      } alt="${esc(tonight.face.alt)}" width="${tonight.face.width || 1536}" height="${tonight.face.height || 1024}" loading="lazy" decoding="async">`
    : "";
  const door = (art, name, line, cls) => `
        <figure class="w-door ${cls}">
          <div class="w-door-frame">${pic(art, { sizes: "(min-width: 900px) 300px, 44vw", w: 960, h: 1200 })}</div>
          <figcaption><span class="w-door-name">${esc(name)}</span><span class="w-door-line">${esc(line)}</span></figcaption>
        </figure>`;
  const step = (n, art, title, body, alt) => `
      <li class="w-step">
        <div class="w-step-art">${pic(art, { alt, sizes: "(min-width: 900px) 320px, (min-width: 700px) 27vw, 86vw", w: 960, h: 960 })}</div>
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
<title>Wonder Daily · A printable learning pack</title>
<link rel="preload" href="./fonts/newsreader-latin-variable.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="./fonts/newsreader-latin-italic-variable.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="./fonts/inter-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="./welcome.css">
</head>
<body>
<header class="w-top">
  <p class="w-brand">Wonder Together<span>Wonder Daily</span></p>
  <p class="w-top-note">Printable packs</p>
</header>
<main>
  <section class="w-hero" aria-labelledby="w-hero-title">
    <div class="w-hero-scene">
      ${pic(WELCOME_ART.hero, { alt: "Two cartoon bears, one big and one small, curled up in a window nook at dusk, reading a picture book by lamplight under a crescent moon.", sizes: "(min-width: 900px) 56vw, 100vw", w: 1600, h: 1067, cls: "w-hero-img", lazy: false })}
    </div>
    <div class="w-hero-copy">
      <p class="w-kicker">For parents</p>
      <h1 id="w-hero-title">One learning pack.<br><em>Built around one question.</em></h1>
      <p class="w-lede">Wonder Daily packs are made for one day each. A pack has a story to read, a few problems, and something to do or make. Print the pages, or open the pack on a tablet. You sit with your child while they work.</p>
      <a class="w-start" href="#start">Sign-up status <span aria-hidden="true">→</span></a>
    </div>
    <article class="w-pack" aria-label="Latest pack">
      <p class="w-pack-label">Latest pack <span>an example of one day</span></p>
      <div class="w-pack-window">${face}</div>
      <h2>${esc(tonight.title)}</h2>
      <p class="w-pack-teaser">${esc(tonight.teaser || "")}</p>
      <ul class="w-pack-parts"><li>Story</li><li>Why</li><li>Activities</li><li>PDFs</li></ul>
    </article>
  </section>

  <section class="w-doors" aria-labelledby="w-doors-title">
    <p class="w-kicker">More than one child</p>
    <h2 id="w-doors-title">One family page.<br><em>Two doors.</em></h2>
    ${squiggle}
    <p class="w-lede">Bookmark one family page. It has two doors, one for Big Wonderer and one for Little Wonderer.</p>
    <div class="w-family">
      <p class="w-family-label">Family page <span>bookmark it once</span></p>
      <div class="w-door-row">${door(WELCOME_ART.doorBig, "Big Wonderer’s door", "Reading, math, and writing.", "is-big")}${door(WELCOME_ART.doorLittle, "Little Wonderer’s door", "Picture stories, counting, and tracing.", "is-little")}
      </div>
      <p class="w-family-foot">Each door opens the latest pack, past packs, and PDFs to print.</p>
    </div>
  </section>

  <section class="w-how" aria-labelledby="w-how-title">
    <p class="w-kicker">How it works</p>
    <h2 id="w-how-title">Three steps.<br><em>One pack at a time.</em></h2>
    ${squiggle}
    <ol class="w-steps">${step("i.", WELCOME_ART.stepPick, "Start with one question.", "Each pack is built around one everyday question. The story, math, and activities all come back to it.", "A big bear and a small bear look at a moon pebble, a snail shell and a tiny raincloud in a jar on a low table.")}${step("ii.", WELCOME_ART.stepRead, "Work through it together.", "Read the story aloud, then work through the problems and the activity. Print the pages, or open the pack on a tablet.", "A big bear and a small bear reading a printed booklet together on a bed under lamplight.")}${step("iii.", WELCOME_ART.stepNote, "Check the answers.", "Big Wonderer’s pack comes with a separate answer key for grown-ups. Print it apart from your child’s pages.", "A big bear alone at a kitchen table with a cup of tea, reading a small folded note.")}
    </ol>
  </section>

  <section class="w-cta" id="start" aria-labelledby="w-cta-title">
    <div>
      <p class="w-kicker">Sign-up</p>
      <h2 id="w-cta-title"><em>Sign-up is not open.</em><br>Nothing is sent.</h2>
    </div>
    <form class="w-form" data-stub="email-capture" action="#start" onsubmit="return false" novalidate>
      <p id="w-form-note" class="w-form-note">This form is switched off. Nothing you type here is sent. The packs themselves need no account.</p>
      <fieldset disabled aria-describedby="w-form-note">
        <legend class="w-sr">Email sign-up, not open</legend>
        <label for="w-email">Email address</label>
        <div class="w-form-row">
          <input id="w-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" aria-describedby="w-form-note">
          <button type="submit" disabled aria-describedby="w-form-note">Sign up</button>
        </div>
      </fieldset>
    </form>
  </section>
</main>
<footer class="w-foot"><p><em>Past packs stay on the shelf. Open any one when you like.</em></p><p>Wonder Daily · from Wonder Together</p></footer>
</body>
</html>
`;
}
