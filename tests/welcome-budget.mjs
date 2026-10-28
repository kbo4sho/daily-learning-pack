// Page-weight budget for the hidden /welcome/ page, in bytes of response
// bodies (compressed assets as served; HTML and CSS counted uncompressed).
//
// TARGET_390 is the goal for a phone: about 600 KB. LIMIT is what CI enforces.
// The plate-as-webp change and the font subset brought the page to about
// 620 KB, so LIMIT sits just above that. Lower it when the page gets lighter.
// Never raise LIMIT to make a build pass.
export const TARGET_390 = 600_000;
export const LIMIT = { 390: 650_000, 820: 690_000, 1440: 550_000 };
// The pack-card plate changes every day and is budgeted by itself: the page
// total below leaves it out, and each plate copy must stay under PLATE_LIMIT.
export const PLATE_LIMIT = 100_000;
export const MAX_IMAGE = 210_000;
