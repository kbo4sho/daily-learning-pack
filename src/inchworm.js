// Shared by the digital motion and the printed illustrations. Positions are
// drawing units, never inches. Front and rear alternate as fixed anchors.
export const wormPoseTitles = [
  "Front legs grip the leaf. The body is stretched behind them.",
  "The front holds on while the rear pulls up, bending the middle into a loop.",
  "The rear holds on while the front stretches forward.",
];

export function wormPose(stage) {
  const rear = 112 + 100 * Math.min(stage, 1);
  const front = 292 + 100 * Math.max(stage - 1, 0);
  const gap = front - rear;
  const lift = 12 + 85 * (1 - Math.abs(stage - 1));
  const point = (t) => ({
    x: rear + gap * (0.54 * t + 1.38 * t * t - 0.92 * t * t * t),
    y: 146 - 3 * lift * t * (1 - t),
  });
  const body = `M${rear} 146 C${rear + gap * 0.18} ${146 - lift} ${front - gap * 0.18} ${146 - lift} ${front} 146`;
  const segments = Array.from({ length: 11 }, (_, i) => {
    const t = (i + 1) / 13;
    const p = point(t);
    const dx = gap * (0.54 + 2.76 * t - 2.76 * t * t);
    const dy = -3 * lift * (1 - 2 * t);
    const length = Math.hypot(dx, dy);
    return `M${p.x - (dy / length) * 5} ${p.y + (dx / length) * 5} l${(dy / length) * 10} ${(-dx / length) * 10}`;
  }).join(" ");
  return {
    rear,
    front,
    body,
    segments,
    rearLegs: `M${rear} 151v12h-7 m16-13v13h-6`,
    frontLegs: `M${front - 23} 149l3 14h5 m3-13 3 13h5 m3-12 3 12h5`,
    headCx: front + 3,
    eyeCx: front + 7,
    rearLeader: `M${rear - 5} 134l-18-18h-25`,
    frontLeader: `M${front + 8} 129l16-21h24`,
    rearLabelX: rear - 54,
    frontLabelX: front + 22,
    rearAnchorCx: rear + 2,
    frontAnchorCx: front - 8,
  };
}

// Browser-only: loaded as a module for inchworms packs.
if (
  typeof document !== "undefined" &&
  document.body?.dataset?.kind === "inchworms"
) {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const content = JSON.parse($("#lesson-content").textContent);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let frame;
  let target = 0;
  function drawWorm(stage) {
    const pose = wormPose(stage);
    const svg = $(".inchworm-scene svg");
    const set = (selector, attribute, value) =>
      svg.querySelector(selector).setAttribute(attribute, value);
    set(".worm-body", "d", pose.body);
    set(".worm-fill", "d", pose.body);
    set(".worm-segments", "d", pose.segments);
    set(".rear-legs", "d", pose.rearLegs);
    set(".front-legs", "d", pose.frontLegs);
    set(".worm-head", "cx", pose.headCx);
    set(".worm-eye", "cx", pose.eyeCx);
    set(".rear-leader", "d", pose.rearLeader);
    set(".front-leader", "d", pose.frontLeader);
    set(".rear-label", "x", pose.rearLabelX);
    set(".front-label", "x", pose.frontLabelX);
    set(".rear-anchor", "cx", pose.rearAnchorCx);
    set(".front-anchor", "cx", pose.frontAnchorCx);
  }
  function settle() {
    cancelAnimationFrame(frame);
    // Stretch assigns stage/pose 2 here; motion Stretch begins at 1 below.
    $(".inchworm-scene").dataset.stage = target;
    $(".inchworm-scene svg").dataset.pose = target;
    drawWorm(target);
  }
  $$("[data-motion-step]").forEach((button) => {
    button.addEventListener("click", () => {
      cancelAnimationFrame(frame);
      target = Number(button.dataset.motionStep);
      // Grip/Loop update cues immediately. Motion Stretch starts at loop (1)
      // so CSS matches drawWorm(target-1); stage/pose 2 only in settle().
      // Reduced-motion Stretch skips this and goes straight to settle().
      if (target !== 2) {
        $(".inchworm-scene").dataset.stage = target;
        $(".inchworm-scene svg").dataset.pose = target;
      } else if (!reducedMotion.matches) {
        $(".inchworm-scene").dataset.stage = 1;
        $(".inchworm-scene svg").dataset.pose = 1;
      }
      $$("[data-motion-step]").forEach((b) =>
        b.setAttribute("aria-pressed", String(b === button)),
      );
      $("#motion-caption").textContent = content.motion[target].text;
      $("#inchworm-motion-title").textContent = wormPoseTitles[target];
      // Every tap is independently understandable: Loop demonstrates 0 → 1;
      // Stretch demonstrates 1 → 2. Grip resets without reversing the animal.
      if (target > 0 && !reducedMotion.matches) {
        drawWorm(target - 1);
        let start;
        const tick = (time) => {
          start ??= time;
          const progress = Math.min((time - start) / 1000, 1);
          drawWorm(target - 1 + (1 - Math.cos(progress * Math.PI)) / 2);
          if (progress < 1 && !reducedMotion.matches && !$("#math").hidden)
            frame = requestAnimationFrame(tick);
          else settle();
        };
        frame = requestAnimationFrame(tick);
      } else {
        settle();
      }
    });
  });
  reducedMotion.addEventListener("change", settle);
  $$("[data-subject], [data-finish]").forEach((button) =>
    button.addEventListener("click", settle),
  );
  document.body.classList.add("inchworm-interactive");
  let loops = 0;
  function updateLoops() {
    $("#loop-feedback").textContent =
      loops === 0
        ? "0 inches. Each pair adds 2 inches."
        : `${loops} inches in our model. ${loops} pretend loops.${loops === 20 ? " You reached 20 by twos! Start at 0 to try again." : ` ${loops - 2} + 2 = ${loops}.`}`;
    $("#add-loops").disabled = loops === 20;
  }
  $("#add-loops").addEventListener("click", () => {
    if (loops >= 20) return;
    loops += 2;
    const pair = document.createElement("span");
    pair.className = "counted";
    pair.textContent = String(loops);
    $("#loop-pairs").append(pair);
    updateLoops();
  });
  $("#reset-loops").addEventListener("click", () => {
    loops = 0;
    $("#loop-pairs").replaceChildren();
    updateLoops();
  });
}
