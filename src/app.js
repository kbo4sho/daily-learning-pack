const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const completed = new Set();
function showSubject(name, focus = true) {
  $$(".lesson-panel").forEach((panel) => {
    panel.hidden = panel.id !== name;
  });
  $$(".subject-button").forEach((button) => {
    const active = button.dataset.subject === name;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (focus) $(`#${name}-heading`).focus({ preventScroll: true });
}
$$(".subject-button").forEach((button) =>
  button.addEventListener("click", () => showSubject(button.dataset.subject)),
);
showSubject("math", false);
$$("[data-finish]").forEach((button) =>
  button.addEventListener("click", () => {
    completed.add(button.dataset.finish);
    const nav = $(`[data-subject="${button.dataset.finish}"]`);
    nav.querySelector(".done-mark").textContent = "✓";
    nav.setAttribute(
      "aria-label",
      `${button.dataset.finish}, 15 minutes, complete`,
    );
    $("#completion").textContent =
      completed.size === 3
        ? "You counted, read, and shared your ideas. What will you wonder about next?"
        : `${completed.size} of 3 discoveries complete.`;
    if (button.dataset.next) {
      showSubject(button.dataset.next);
      $(".subject-nav").scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
    }
  }),
);
if (document.body.dataset.kind === "fair-sharing") {
  let parts = 1;
  let selected = new Set([0]);
  function updateCaption() {
    const amount = selected.size;
    const names =
      parts === 2
        ? ["No parts chosen.", "One half.", "Two halves. One whole."]
        : [
            "No parts chosen.",
            "One fourth.",
            "Two fourths. One half.",
            "Three fourths.",
            "Four fourths. One whole.",
          ];
    $("#fraction-name").textContent =
      parts === 1
        ? amount
          ? "One whole."
          : "No parts chosen."
        : names[amount];
    $("#fraction-explanation").textContent =
      parts === 1
        ? amount
          ? "All of it, before we share."
          : "The whole is still here. Tap it to choose it."
        : `${amount} of ${parts} equal parts chosen (${amount}/${parts}). Tap a part to choose it or put it back.`;
  }
  function draw() {
    const shape = $("#fraction-shape");
    shape.className = `fraction-shape parts-${parts}`;
    shape.replaceChildren(
      ...Array.from({ length: parts }, (_, i) => {
        const button = document.createElement("button");
        button.className = "piece";
        button.setAttribute(
          "aria-label",
          parts === 1
            ? "One whole"
            : `Part ${i + 1} of ${parts}, one ${parts === 2 ? "half" : "fourth"}`,
        );
        button.setAttribute("aria-pressed", String(selected.has(i)));
        button.addEventListener("click", () => {
          selected.has(i) ? selected.delete(i) : selected.add(i);
          button.setAttribute("aria-pressed", String(selected.has(i)));
          updateCaption();
        });
        return button;
      }),
    );
    $("#whole-label").textContent =
      parts === 1 ? "1 whole" : `${parts} equal parts · same whole`;
    $$("[data-parts]").forEach((b) =>
      b.setAttribute("aria-pressed", String(Number(b.dataset.parts) === parts)),
    );
    updateCaption();
  }
  $$("[data-parts]").forEach((b) =>
    b.addEventListener("click", () => {
      parts = Number(b.dataset.parts);
      selected = new Set([0]);
      draw();
    }),
  );
  $("#reset-whole").addEventListener("click", () => {
    parts = 1;
    selected = new Set([0]);
    draw();
  });
  $$("[data-answer]").forEach((b) =>
    b.addEventListener("click", () => {
      $("#quiz-feedback").textContent =
        b.dataset.answer === "no"
          ? "You noticed the sizes! Halves must be equal. Two unequal pieces are not halves."
          : "There are two pieces. Now compare their sizes: one is bigger. Halves must be equal. Try again.";
    }),
  );
  draw();
} else if (document.body.dataset.kind === "engines") {
  const content = JSON.parse($("#engine-content").textContent);
  const mechanism = $(".mechanism");
  let motionFrame;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  // A slider-crank linkage, shown only over its outward (power) stroke.
  // The pin stays on the crank circle; the connecting rod keeps its length.
  function drawStroke(progress) {
    const angle = Math.PI + progress * Math.PI;
    const pinX = 365 + 40 * Math.cos(angle);
    const pinY = 125 + 40 * Math.sin(angle);
    const pistonX = pinX - Math.sqrt(160 ** 2 - (pinY - 125) ** 2);
    $(".engine-piston").setAttribute("x", pistonX - 18);
    $(".engine-rod").setAttribute("d", `M${pistonX} 125L${pinX} ${pinY}`);
    $(".crank-arm").setAttribute("d", `M${pinX} ${pinY}L365 125`);
    $(".crank-pin").setAttribute("cx", pinX);
    $(".crank-pin").setAttribute("cy", pinY);
    $(".piston-leader").setAttribute("d", `M${pistonX} 181L145 200`);
    $(".rod-leader").setAttribute(
      "d",
      `M${(pistonX + pinX) / 2} ${(125 + pinY) / 2 + 9}L270 200`,
    );
  }
  $$("[data-motion-step]").forEach((button) => {
    button.addEventListener("click", () => {
      cancelAnimationFrame(motionFrame);
      const stage = Number(button.dataset.motionStep);
      mechanism.dataset.stage = stage;
      $$("[data-motion-step]").forEach((b) =>
        b.setAttribute("aria-pressed", String(b === button)),
      );
      $("#motion-caption").textContent = content.motion[stage].text;
      drawStroke(stage === 2 ? 1 : 0);
      if (stage === 2 && !reducedMotion.matches) {
        let start;
        const tick = (time) => {
          start ??= time;
          const progress = Math.min((time - start) / 1200, 1);
          drawStroke((1 - Math.cos(progress * Math.PI)) / 2);
          if (progress < 1 && !reducedMotion.matches && !$("#math").hidden)
            motionFrame = requestAnimationFrame(tick);
          else drawStroke(1);
        };
        motionFrame = requestAnimationFrame(tick);
      }
    });
  });
  $$("[data-engine-answer]").forEach((button) => {
    button.addEventListener("click", () => {
      $("#engine-reading-feedback").textContent =
        content.feedback[Number(button.dataset.engineAnswer)];
    });
  });
  document.body.classList.add("engine-interactive");
  let turns = 0;
  const updateTurns = () => {
    $("#turn-feedback").textContent =
      turns === 0
        ? "0 turns. Add a pair of turns."
        : `${turns} turns. ${turns / 2} ${turns === 2 ? "pair" : "pairs"} of 2.${turns === 20 ? " You counted to 20 by twos! Start at 0 to try again." : ` ${turns - 2} + 2 = ${turns}. What comes next?`}`;
    $("#add-turns").disabled = turns === 20;
  };
  $("#add-turns").addEventListener("click", () => {
    if (turns >= 20) return;
    turns += 2;
    const pair = document.createElement("span");
    pair.className = "turn-pair";
    pair.innerHTML = `<span>↻ ↻</span><b>${turns}</b>`;
    $("#turn-pairs").append(pair);
    updateTurns();
  });
  $("#reset-turns").addEventListener("click", () => {
    turns = 0;
    $("#turn-pairs").replaceChildren();
    updateTurns();
  });
} else {
  const updateCount = () => {
    const count = $$('.count-word[aria-pressed="true"]').length;
    $("#count-feedback").textContent =
      `${count} word${count === 1 ? "" : "s"} touched.${count === $$(".count-word").length ? " You counted every word once!" : ""}`;
  };
  $$(".count-word").forEach((b) =>
    b.addEventListener("click", () => {
      b.setAttribute(
        "aria-pressed",
        String(b.getAttribute("aria-pressed") !== "true"),
      );
      updateCount();
    }),
  );
  $("#reset-words").addEventListener("click", () => {
    $$(".count-word").forEach((b) => b.setAttribute("aria-pressed", "false"));
    updateCount();
  });
}
