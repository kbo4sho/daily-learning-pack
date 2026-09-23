import { drawWormPose } from "./inchworm.js";
import { drawGrowthPose } from "./growth.js";

// Progressive enhancement: without JS every passage remains in reading order.
const reader = document.querySelector(".family-reader");
if (reader) {
  const beats = [...reader.querySelectorAll("[data-reader-beat]")];
  const back = reader.querySelector("[data-reader-back]");
  const next = reader.querySelector("[data-reader-next]");
  const nextLabel = next.querySelector("[data-reader-next-label]");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let index = 0;
  let pageTurn;
  let frame;

  function settle() {
    pageTurn?.cancel();
    cancelAnimationFrame(frame);
    const beat = beats[index];
    if (beat.dataset.readerPose !== undefined)
      drawWormPose(beat.querySelector("svg"), Number(beat.dataset.readerPose));
    if (beat.dataset.growthPose !== undefined) {
      const growthSvg = beat.querySelector('[aria-current="step"] svg');
      if (growthSvg) drawGrowthPose(growthSvg, Number(beat.dataset.growthPose));
    }
  }

  function showBeat(destination, focus = true) {
    if (destination < 0 || destination >= beats.length) return;
    settle();
    const previous = index;
    index = destination;
    // Hide the old page before revealing the new one: no overlapping passages,
    // hidden tab stops, queued timers, or delayed changes to the reading order.
    beats.forEach((beat, i) => {
      beat.hidden = i !== index;
    });
    const beat = beats[index];
    const onCover = beat.dataset.readerBeat === "cover";
    back.disabled = index === 0;
    next.hidden = index === beats.length - 1;
    if (nextLabel) nextLabel.textContent = onCover ? "Open the story" : "Next";
    reader.querySelector("#reader-position").textContent = onCover
      ? "Cover"
      : `${index} / ${beats.length - 1}${index === beats.length - 1 ? " · The end" : ""}`;

    if (focus) {
      beat.querySelector("h3").focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    if (!focus || reducedMotion.matches) return;

    // Opacity-only page enter. The diagram morph is separate teaching motion.
    pageTurn = beat
      .querySelector(".reader-copy")
      .animate([{ opacity: 0.25 }, { opacity: 1 }], {
        duration: 500,
        easing: "ease",
        fill: "none",
      });

    const isGrowth = beat.dataset.growthPose !== undefined;
    const pose = Number(
      isGrowth ? beat.dataset.growthPose : beat.dataset.readerPose,
    );
    const from = Number(
      isGrowth
        ? beats[previous].dataset.growthPose
        : beats[previous].dataset.readerPose,
    );
    const drawPose = isGrowth ? drawGrowthPose : drawWormPose;
    // Only consecutive forward poses morph. Back/restart remain still, so
    // animals never walk backwards and seedlings never seem to shrink.
    if (index === previous + 1 && pose > 0 && pose === from + 1) {
      const svg = beat.querySelector(
        isGrowth ? '[aria-current="step"] svg' : "svg",
      );
      if (!svg) return;
      drawPose(svg, from);
      let start;
      const tick = (time) => {
        start ??= time;
        const progress = Math.min((time - start) / 500, 1);
        drawPose(svg, from + (1 - Math.cos(progress * Math.PI)) / 2);
        if (progress < 1) frame = requestAnimationFrame(tick);
        else drawPose(svg, pose);
      };
      frame = requestAnimationFrame(tick);
    }
  }

  back.addEventListener("click", () => showBeat(index - 1));
  next.addEventListener("click", () => showBeat(index + 1));
  reader
    .querySelector("[data-reader-restart]")
    .addEventListener("click", () => {
      reader
        .querySelectorAll("details")
        .forEach((detail) => (detail.open = false));
      reader.querySelector("#reading-feedback").textContent =
        "Talk together, then tap an idea. You can try again.";
      showBeat(0);
    });
  reducedMotion.addEventListener("change", settle);
  document.addEventListener("subjectchange", settle);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) settle();
  });
  window.addEventListener("beforeprint", settle);
  showBeat(0, false);
  reader.querySelector(".reader-controls").hidden = false;
  reader.classList.add("reader-ready");
}
