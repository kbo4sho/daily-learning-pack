// Page-weight budget for the hidden /welcome/ page, in bytes of response
// bodies (compressed assets as served; HTML and CSS counted uncompressed).
//
// TARGET is where PR-B (plate served as webp, sized to display) and PR-C (font
// subset) should land: about 600 KB at 390 px. LIMIT is what CI enforces now.
// Each of those PRs lowers LIMIT. The last step sets LIMIT to TARGET plus a
// small margin. Never raise LIMIT to make a build pass.
export const TARGET_390 = 600_000;
export const LIMIT = { 390: 840_000, 820: 880_000, 1440: 740_000 };
// The pack-card plate changes every day and is budgeted by itself: the page
// total below leaves it out, and each plate copy must stay under PLATE_LIMIT.
export const PLATE_LIMIT = 100_000;
export const MAX_IMAGE = 210_000;
