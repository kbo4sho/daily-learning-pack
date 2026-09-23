// A schematic companion to the scenic plates: roots extend below a fixed soil
// line; the hooked shoot lifts the seed halves, then leaves open. Not to scale.
export function growthPose(stage) {
  const clamp = (n) => Math.max(0, Math.min(1, n));
  const root = 3 * clamp(stage - 1) + 29 * clamp((stage - 2) / 3);
  const shoot = clamp(stage - 3);
  const leaves = clamp(stage - 4);
  return {
    root: `M40 47 Q${40 - root / 3} ${47 + root / 2} 40 ${47 + root}`,
    shoot: `M40 45 C${40 - shoot * 22} ${45 - shoot * 40} ${40 + shoot * 20} ${45 - shoot * 48} ${40 + shoot * 8 * (1 - leaves)} ${45 - shoot * 22 - leaves * 10}`,
    leaf: `M40 13 Q${40 - leaves * 24} ${13 - leaves * 15} ${40 - leaves * 19} ${13 + leaves * 4} Q${40 - leaves * 8} ${13 + leaves * 11} 40 13 M40 13 Q${40 + leaves * 24} ${13 - leaves * 15} ${40 + leaves * 19} ${13 + leaves * 4} Q${40 + leaves * 8} ${13 + leaves * 11} 40 13`,
    seedX: 40 + 8 * shoot * (1 - leaves),
    seedY: 43 - 20 * shoot + 8 * leaves,
    swell: 1 + 0.13 * clamp(stage),
    split: clamp(stage - 1),
  };
}
export function growthDiagram(stage) {
  const p = growthPose(stage);
  return `<svg data-growth-diagram data-growth-stage="${stage}" viewBox="0 0 80 84" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M5 46H27M53 46H75" opacity=".35"/><path data-growth-root d="${p.root}"/><path data-growth-shoot d="${p.shoot}"/><path data-growth-leaf d="${p.leaf}"/><ellipse data-growth-seed cx="${p.seedX}" cy="${p.seedY}" rx="${8 * p.swell}" ry="${6 * p.swell}" fill="var(--paper, white)"/><path data-growth-split d="M${p.seedX} ${p.seedY - 6}q-5 6 0 12" opacity="${p.split}"/></g></svg>`;
}
export function drawGrowthPose(svg, stage) {
  const p = growthPose(stage);
  for (const part of ["root", "shoot", "leaf"])
    svg.querySelector(`[data-growth-${part}]`).setAttribute("d", p[part]);
  svg.querySelector("[data-growth-seed]").setAttribute("cx", p.seedX);
  svg.querySelector("[data-growth-seed]").setAttribute("cy", p.seedY);
  svg
    .querySelector("[data-growth-split]")
    .setAttribute("d", `M${p.seedX} ${p.seedY - 6}q-5 6 0 12`);
  svg.querySelector("[data-growth-seed]").setAttribute("rx", 8 * p.swell);
  svg.querySelector("[data-growth-seed]").setAttribute("ry", 6 * p.swell);
  svg.querySelector("[data-growth-split]").setAttribute("opacity", p.split);
  svg.dataset.growthStage = String(stage);
}
