// Rebuilds the share image (and refreshes the icons) for /welcome/ from the page's own hero
// picture (src/welcome-assets/img/hero-1600.webp). No text, no names. Run it
// only when the hero art changes: `node scripts/make-welcome-share-art.mjs`.
import { copyFile } from "node:fs/promises";
import sharp from "sharp";

const dir = new URL("../src/welcome-assets/", import.meta.url);
const hero = new URL("img/hero-1600.webp", dir).pathname;

// 1200x630 link-preview card: the hero scaled to 1200 wide, cropped in height.
await sharp(hero)
  .resize(1200, 800)
  .extract({ left: 0, top: 60, width: 1200, height: 630 })
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile(new URL("share-1200x630.jpg", dir).pathname);

// Icons: the site's one Wonder Daily app icon (src/app-icons/daily/), so the
// welcome page and every other page share a home-screen icon. Not regenerated.
for (const name of ["favicon-32.png", "apple-touch-icon.png"])
  await copyFile(
    new URL(`../src/app-icons/daily/${name}`, import.meta.url).pathname,
    new URL(name, dir).pathname,
  );
