const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function copyFor(opening, step) {
  const title = opening.dataset.packetTitle;
  const destination = opening.dataset.packetDestination;
  if (step === 1) {
    return {
      state: "flap-lifted",
      visible: "Flap lifted · tear seal",
      spoken: `Flap lifted — ${title} Step 2 of 3: tear the seal. Destination: ${destination}.`,
    };
  }
  return {
    state: "torn",
    visible: `Seal torn · open ${destination}`,
    spoken: `Seal torn — ${title} Step 3 of 3: open ${destination}.`,
  };
}

function reset(opening) {
  opening.dataset.packetState = "sealed";
  const control = opening.querySelector(".packet-ritual-control");
  const instruction = opening.querySelector("[data-packet-instruction]");
  const number = opening.querySelector(".packet-step-number");
  const status = opening.querySelector("[data-packet-status]");
  instruction.textContent = "Press packet · lift flap";
  number.textContent = "1 of 3";
  status.textContent = "";
  control.setAttribute(
    "aria-label",
    reducedMotion.matches
      ? opening.dataset.packetOpenLabel
      : opening.dataset.packetFirstLabel,
  );
}

for (const opening of document.querySelectorAll("[data-packet-opening]")) {
  const control = opening.querySelector(".packet-ritual-control");
  const instruction = opening.querySelector("[data-packet-instruction]");
  const number = opening.querySelector(".packet-step-number");
  const status = opening.querySelector("[data-packet-status]");

  reset(opening);

  control.addEventListener("click", (event) => {
    if (
      reducedMotion.matches ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;

    const state = opening.dataset.packetState;
    if (state === "torn") return;

    event.preventDefault();
    const step = state === "sealed" ? 1 : 2;
    const next = copyFor(opening, step);
    opening.dataset.packetState = next.state;
    instruction.textContent = next.visible;
    number.textContent = `${step + 1} of 3`;
    control.setAttribute("aria-label", next.spoken);
    status.textContent = next.spoken;
  });
}

reducedMotion.addEventListener("change", () => {
  for (const opening of document.querySelectorAll("[data-packet-opening]"))
    reset(opening);
});

document.documentElement.classList.add("packet-ritual-ready");
