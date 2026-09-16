import { drawWormPose } from "./inchworm.js";

// Progressive enhancement: without JS every passage remains in reading order.
const reader = document.querySelector(".family-reader");
if (reader) {
  const beats = [...reader.querySelectorAll("[data-reader-beat]")];
  const back = reader.querySelector("[data-reader-back]");
  const next = reader.querySelector("[data-reader-next]");
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
    back.disabled = index === 0;
    next.hidden = index === beats.length - 1;
    reader.querySelector("#reader-position").textContent =
      `${index + 1} / ${beats.length}${index === beats.length - 1 ? " · The end" : ""}`;

    if (focus) {
      beat.querySelector("h3").focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    if (!focus || reducedMotion.matches) return;

    const direction = index > previous ? 1 : -1;
    pageTurn = beat.querySelector(".reader-copy").animate(
      [
        {
          opacity: 0.25,
          transform: `perspective(1200px) translateX(${direction * 12}px) rotateY(${direction * -3}deg)`,
        },
        { opacity: 1, transform: "none" },
      ],
      { duration: 500, easing: "ease", fill: "none" },
    );

    const pose = Number(beat.dataset.readerPose);
    const from = Number(beats[previous].dataset.readerPose);
    // Forward story turns teach the movement in the same letterbox: the front
    // stays fixed for the loop, then the rear stays fixed for the stretch.
    // Back/restart never makes the animal appear to walk backwards.
    if (index === previous + 1 && pose > 0 && pose === from + 1) {
      const svg = beat.querySelector("svg");
      drawWormPose(svg, from);
      let start;
      const tick = (time) => {
        start ??= time;
        const progress = Math.min((time - start) / 500, 1);
        drawWormPose(svg, from + (1 - Math.cos(progress * Math.PI)) / 2);
        if (progress < 1) frame = requestAnimationFrame(tick);
        else drawWormPose(svg, pose);
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
