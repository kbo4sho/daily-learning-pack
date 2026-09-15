// Shared by the digital motion and the printed illustrations. Positions are
// drawing units, never inches. Front and rear alternate as fixed anchors.
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
  return { rear, front, body, segments };
}
