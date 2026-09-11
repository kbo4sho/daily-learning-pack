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
