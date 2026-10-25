// Pure utilities for a steadier hand-controlled cursor.
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export function pinchRatio(points) {
  if (!points || !points[4] || !points[8] || !points[5] || !points[17]) return null;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const palm = distance(points[5], points[17]);
  if (!Number.isFinite(palm) || palm < 0.035) return null;
  return distance(points[4], points[8]) / palm;
}

// Hysteresis and two-frame confirmation eliminate quick flickers at the threshold.
export function nextPinchState(previous, ratio, threshold = 0.34) {
  const last = previous || { active: false, closeFrames: 0, openFrames: 0 };
  if (!Number.isFinite(ratio)) return { ...last };
  if (last.active) {
    const openFrames = ratio > threshold + 0.14 ? last.openFrames + 1 : 0;
    return { active: openFrames < 2, closeFrames: 0, openFrames: openFrames < 2 ? openFrames : 0 };
  }
  const closeFrames = ratio < threshold ? last.closeFrames + 1 : 0;
  return { active: closeFrames >= 2, closeFrames: closeFrames >= 2 ? 0 : closeFrames, openFrames: 0 };
}

export function smoothCursor(previous, target, elapsedMs, baseSpeed = 0.34) {
  const x = clamp(target.x, 0, 1);
  const y = clamp(target.y, 0, 1);
  if (!previous) return { x, y };
  const travel = Math.hypot(x - previous.x, y - previous.y);
  // Small movements are smoothed heavily; larger intentional motions respond faster.
  const alpha = clamp(baseSpeed + travel * 3.1, 0.12, 0.88);
  const adjusted = 1 - Math.pow(1 - alpha, clamp(elapsedMs / 33, 0.45, 2.5));
  return {
    x: previous.x + (x - previous.x) * adjusted,
    y: previous.y + (y - previous.y) * adjusted
  };
}
