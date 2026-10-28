// Rebuilds the share image and icons for /welcome/ from the page's own hero
// picture (src/welcome-assets/img/hero-1600.webp). No text, no names. Run it
// only when the hero art changes: `node scripts/make-welcome-share-art.mjs`.
import sharp from "sharp";

const dir = new URL("../src/welcome-assets/", import.meta.url);
const hero = new URL("img/hero-1600.webp", dir).pathname;

// 1200x630 link-preview card: the hero scaled to 1200 wide, cropped in height.
await sharp(hero)
  .resize(1200, 800)
  .extract({ left: 0, top: 60, width: 1200, height: 630 })
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile(new URL("share-1200x630.jpg", dir).pathname);

// Icons: the two bears, square crop.
const bears = { left: 520, top: 300, width: 560, height: 560 };
for (const [name, size] of [
  ["favicon-32.png", 32],
  ["apple-touch-icon.png", 180],
])
  await sharp(hero)
    .extract(bears)
    .resize(size, size)
    .png({ palette: true, quality: 85, effort: 10 })
    .toFile(new URL(name, dir).pathname);
