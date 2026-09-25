// Light port of kbo4sho/super-dad PR #37. Daily binds its own pack/plate registry.
export const ZINE_IMPOSITION = [
  { panel: 5, rotation: 180 },
  { panel: 4, rotation: 180 },
  { panel: 3, rotation: 180 },
  { panel: 2, rotation: 180 },
  { panel: 6, rotation: 0 },
  { panel: 7, rotation: 0 },
  { panel: 8, rotation: 0 },
  { panel: 1, rotation: 0 },
];
export const ZINE_FOLD_STEPS = [
  "Print one-sided: US Letter, landscape, actual size / 100%. No fit. Headers/footers off.",
  "Fold long edge to long edge; reopen. Fold short edge to short edge, then in half again. Open: eight boxes.",
  "Cut only the solid center line across the middle two boxes. Keep the outer boxes joined.",
  "Refold long edge to long edge, print outside. Push ends together to open a diamond, then a cross.",
  "Wrap into a book with page 1 in front. Follow pages 1 to 8.",
];
export const ZINE_COVER_LINE = "Six small moments. One question to keep.";
export const ZINE_INSTRUCTION_NOTE =
  "Pictures are simplified and not to scale. Look closely, wonder, and pause whenever you like.";
export const ZINE_PLATE_MAX_PX = 720;
export const ZINE_FONT_FILES = {
  serif: "fonts/newsreader-latin-400-normal.woff",
  sans: "fonts/inter-latin-400-normal.woff",
};
export function zinePanels(pack) {
  if (pack.reading.beats.length > 6)
    throw new Error("One sheet holds at most six story beats.");
  const byId = new Map(pack.plates.map((p) => [p.id, p]));
  const resolve = (id) => {
    const art = byId.get(id);
    if (!art) throw new Error(`Missing story plate: ${id}`);
    return art.src;
  };
  const panels = [{ kind: "cover", src: resolve(pack.reading.coverPlate) }];
  for (const beat of pack.reading.beats)
    panels.push({ kind: "story", ...beat, src: resolve(beat.plate) });
  while (panels.length < 7) panels.push({ kind: "pause" });
  return [...panels, { kind: "instructions" }];
}
export function zineKidCopy(pack) {
  return [
    pack.title,
    pack.reading.title,
    pack.reading.coverText,
    ZINE_COVER_LINE,
    ...pack.reading.beats.flatMap((beat) => [
      beat.title,
      beat.passage,
      beat.prompt,
    ]),
    "A little pause.",
    "Look back at a picture. What do you notice now? You can rest here or begin again.",
    "Make a little book.",
    ...ZINE_FOLD_STEPS,
    ZINE_INSTRUCTION_NOTE,
  ].join("\n");
}
export function wrapText(text, font, size, width) {
  const normalized = text
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  const lines = [];
  let line = "";
  for (const word of normalized.split(" ")) {
    if (font.widthOfTextAtSize(word, size) > width)
      throw new Error("A word exceeds its print panel.");
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}
export async function generateZine(
  pack,
  loadPlate,
  lib,
  { fontkit, loadFont },
) {
  const {
    PDFDocument,
    PrintScaling,
    popGraphicsState,
    pushGraphicsState,
    rgb,
    rotateDegrees,
    translate,
  } = lib;
  const panels = zinePanels(pack);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`${pack.title} - foldable family story`);
  pdf.setAuthor("Wonder Together");
  pdf.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None);
  const sheet = pdf.addPage([792, 612]);
  const [serif, sans] = await Promise.all([
    loadFont(ZINE_FONT_FILES.serif).then((bytes) =>
      pdf.embedFont(bytes, { subset: true }),
    ),
    loadFont(ZINE_FONT_FILES.sans).then((bytes) =>
      pdf.embedFont(bytes, { subset: true }),
    ),
  ]);
  const ink = rgb(0.16, 0.23, 0.21);
  const muted = rgb(0.35, 0.39, 0.36);
  const images = new Map();
  for (const [slotIndex, slot] of ZINE_IMPOSITION.entries()) {
    const panelIndex = slot.panel - 1;
    const panel = panels[panelIndex];
    const x = (slotIndex % 4) * 198;
    const y = slotIndex < 4 ? 306 : 0;
    sheet.pushOperators(
      pushGraphicsState(),
      translate(x + (slot.rotation ? 198 : 0), y + (slot.rotation ? 306 : 0)),
      rotateDegrees(slot.rotation),
    );
    const text = (
      value,
      y,
      size = 10,
      maxLines = 8,
      font = sans,
      color = ink,
    ) => {
      const lines = wrapText(value, font, size, 162);
      if (lines.length > maxLines)
        throw new Error(
          `Panel ${panelIndex + 1}: copy exceeds its print area.`,
        );
      lines.forEach((line, i) =>
        sheet.drawText(line, {
          x: 18,
          y: y - i * size * 1.25,
          size,
          font,
          color,
        }),
      );
      return y - lines.length * size * 1.25;
    };
    const picture = async (src, y, height = 108) => {
      let image = images.get(src);
      if (!image) {
        const bytes = await loadPlate(src);
        image =
          bytes[0] === 0x89
            ? await pdf.embedPng(bytes)
            : await pdf.embedJpg(bytes);
        images.set(src, image);
      }
      const size = image.scaleToFit(162, height);
      sheet.drawImage(image, { x: (198 - size.width) / 2, y, ...size });
    };
    text("WONDER TOGETHER / DAILY", 284, 6.5, 1, sans, muted);
    if (panel.kind === "cover") {
      text(pack.title, 246, 27, 2, serif);
      text(pack.reading.title, 193, 11, 2, serif);
      await picture(panel.src, 72);
      text(ZINE_COVER_LINE, 56, 8, 2);
      text("GRADE 2 / DOGFOOD PREVIEW", 30, 6.5, 1, sans, muted);
    } else if (panel.kind === "story") {
      await picture(panel.src, 136);
      text(panel.passage, 122, 9.5, 8);
    } else if (panel.kind === "pause") {
      text("A little pause.", 224, 24, 2, serif);
      text(
        "Look back at a picture. What do you notice now? You can rest here or begin again.",
        166,
        12,
        7,
      );
    } else {
      text("Make a little book.", 260, 18, 2, serif);
      let y = 234;
      for (const [i, step] of ZINE_FOLD_STEPS.entries())
        y = text(`${i + 1}. ${step}`, y, 7.8, 5) - 4;
      if (y < 77) throw new Error("Fold instructions overlap the cut diagram.");
      const x = 55,
        dy = 49,
        w = 88,
        h = 24;
      sheet.drawRectangle({
        x,
        y: dy,
        width: w,
        height: h,
        borderWidth: 0.5,
        borderColor: muted,
      });
      for (let col = 1; col < 4; col++)
        sheet.drawLine({
          start: { x: x + (col * w) / 4, y: dy },
          end: { x: x + (col * w) / 4, y: dy + h },
          thickness: 0.4,
          color: muted,
        });
      sheet.drawLine({
        start: { x, y: dy + h / 2 },
        end: { x: x + w, y: dy + h / 2 },
        thickness: 0.4,
        color: muted,
      });
      sheet.drawLine({
        start: { x: x + w / 4, y: dy + h / 2 },
        end: { x: x + (3 * w) / 4, y: dy + h / 2 },
        thickness: 2,
        color: ink,
      });
      text(ZINE_INSTRUCTION_NOTE, 36, 6.8, 3, sans, muted);
    }
    sheet.drawText(String(panelIndex + 1), {
      x: 176,
      y: 18,
      size: 7,
      font: sans,
      color: muted,
    });
    sheet.pushOperators(popGraphicsState());
  }
  for (const x of [198, 396, 594])
    sheet.drawLine({
      start: { x, y: 18 },
      end: { x, y: 594 },
      thickness: 0.35,
      color: rgb(0.75, 0.75, 0.75),
      dashArray: [2, 4],
    });
  sheet.drawLine({
    start: { x: 18, y: 306 },
    end: { x: 774, y: 306 },
    thickness: 0.35,
    color: rgb(0.75, 0.75, 0.75),
    dashArray: [2, 4],
  });
  sheet.drawLine({
    start: { x: 198, y: 306 },
    end: { x: 594, y: 306 },
    thickness: 0.65,
    color: muted,
  });
  return pdf.save({ useObjectStreams: false });
}
