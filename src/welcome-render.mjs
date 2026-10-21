import { esc } from "./html.mjs";

/**
 * Hidden parent welcome page (dist/welcome/). Not linked from any nav,
 * noindex. Name-free: copy speaks of "your kids" and the Big/Little
 * Wonderer characters only. `tonight` is the latest archive day with its
 * resolved story plate (face may be null; the card falls back to type).
 */
export function welcomePage({ tonight, doorArt = [] }) {
  if (!tonight?.title) throw new Error("welcomePage requires tonight's day.");
  const face = tonight.face?.src
    ? `<img class="w-card-art" src="${esc(tonight.face.src)}" alt="${esc(tonight.face.alt)}" width="1536" height="1024">`
    : "";
  const door = (art, name, line) => `
        <div class="w-door">
          <div class="w-door-arch">${
            art?.src
              ? `<img src="${esc(art.src)}" alt="" width="160" height="160" loading="lazy">`
              : ""
          }</div>
          <p class="w-door-name">${esc(name)}</p>
          <p class="w-door-line">${esc(line)}</p>
        </div>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Wonder Daily · A softer goodnight</title>
<link rel="stylesheet" href="./welcome.css">
</head>
<body>
<header class="w-top">
  <p class="w-brand">Wonder Together<span>Wonder Daily</span></p>
</header>
<main>
  <section class="w-hero" aria-labelledby="w-hero-title">
    <div class="w-hero-copy">
      <p class="w-kicker">A parent’s practice · A moment together</p>
      <h1 id="w-hero-title">A little wonder.<br>A softer goodnight.</h1>
      <p class="w-lede">A nightly story, a why, and activities to share. You read and lead. We bring the pack.</p>
      <a class="w-start" href="#start">Start <span aria-hidden="true">↗</span></a>
    </div>
    <article class="w-card" aria-label="Tonight’s pack">
      <p class="w-card-label">Tonight’s pack <span>Read it once, together</span></p>
      ${face}
      <h2>${esc(tonight.title)}</h2>
      <p class="w-card-teaser">${esc(tonight.teaser || "")}</p>
      <ul class="w-card-parts"><li>Story</li><li>A why</li><li>Activities</li><li>PDFs</li></ul>
    </article>
  </section>

  <section class="w-doors" aria-labelledby="w-doors-title">
    <p class="w-kicker">Their own way in. Your time together.</p>
    <h2 id="w-doors-title">One family page.<br>A door for each kid.</h2>
    <p class="w-lede">Nightly stories and activities for your family. Each kid has a door. You read and lead.</p>
    <div class="w-family">
      <p class="w-family-label">Your family page <span>A shared place for little wonderers</span></p>
      <div class="w-door-row">${door(doorArt[0], "Big Wonderer", "A nightly pack, together.")}${door(doorArt[1], "Little Wonderer", "A nightly pack, together.")}
      </div>
      <p class="w-family-foot">Behind every door, a nightly pack: story, a why, activities, PDFs.</p>
    </div>
  </section>

  <section class="w-how" aria-labelledby="w-how-title">
    <p class="w-kicker">How a night works</p>
    <h2 id="w-how-title">A little choice.<br>A night of wonder.</h2>
    <ol class="w-steps">
      <li><span class="w-num">01</span><h3>They pick tomorrow.</h3><p>Choose tomorrow’s topic from three curious ideas.</p></li>
      <li><span class="w-num">02</span><h3>Read tonight’s pack.</h3><p>A story, a why, activities, and PDFs. You read and lead.</p></li>
      <li><span class="w-num">03</span><h3>A note for you.</h3><p>Your evening parent note arrives by email. A quiet moment for you.</p></li>
    </ol>
  </section>

  <section class="w-cta" id="start" aria-labelledby="w-cta-title">
    <h2 id="w-cta-title">Their curiosity. Your company.</h2>
    <!-- TODO(next step): email capture is a placeholder. It is not wired to any
         service and sends nothing. Wire it to a real signup endpoint later. -->
    <form class="w-form" data-stub="email-capture" action="#start" onsubmit="return false" novalidate>
      <label for="w-email">Your email</label>
      <div class="w-form-row">
        <input id="w-email" name="email" type="email" autocomplete="email" placeholder="you@example.com">
        <button type="submit" disabled aria-describedby="w-form-note">Start</button>
      </div>
      <p id="w-form-note" class="w-form-note">Coming soon. Sign-up isn’t open yet, and nothing you type here is sent.</p>
    </form>
  </section>
</main>
<footer class="w-foot"><p>Wonder Daily · Nothing to catch up on.</p></footer>
</body>
</html>
`;
}
