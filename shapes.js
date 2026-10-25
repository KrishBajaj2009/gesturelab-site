// Pure, testable geometry and scoring. All coordinates use a fixed 900 x 560 space.
export const WIDTH = 900;
export const HEIGHT = 560;
const CENTER = { x: 450, y: 280 };

export const LEVELS = [
  { id: 'circle', name: 'Circle', title: 'Trace a Circle', emoji: '◯', subtitle: 'A perfect loop', description: 'Follow the guide in one continuous line.', color: '#FF914D' },
  { id: 'triangle', name: 'Triangle', title: 'Trace a Triangle', emoji: '△', subtitle: 'Three corners', description: 'Find all three corners and connect the edges.', color: '#93BEFF' },
  { id: 'square', name: 'Square', title: 'Trace a Square', emoji: '□', subtitle: 'Four right angles', description: 'Trace each straight edge and turn at the corners.', color: '#FFB57D' },
  { id: 'star', name: 'Star', title: 'Trace a Star', emoji: '☆', subtitle: 'A five-point challenge', description: 'Trace the full star outline without skipping a point.', color: '#B7D2FF' },
  { id: 'diamond', name: 'Diamond', title: 'Trace a Diamond', emoji: '◇', subtitle: 'Secret level', description: 'Follow four slanted edges.', color: '#FFAF74', secret: true, unlockCount: 1 },
  { id: 'hexagon', name: 'Hexagon', title: 'Trace a Hexagon', emoji: '⬡', subtitle: 'Secret level', description: 'Trace six connected sides.', color: '#9AC3FF', secret: true, unlockCount: 2 },
  { id: 'heart', name: 'Heart', title: 'Trace a Heart', emoji: '♡', subtitle: 'Secret level', description: 'Keep the curves smooth.', color: '#FF947B', secret: true, unlockCount: 3 },
  { id: 'infinity', name: 'Infinity', title: 'Trace Infinity', emoji: '∞', subtitle: 'Final secret', description: 'Cross through the center to complete the loop.', color: '#B2BEFF', secret: true, unlockCount: 4 },
];

export function makePath(id) {
  if (id === 'circle') {
    const points = Array.from({ length: 181 }, (_, i) => {
      const angle = -Math.PI / 2 + i * Math.PI * 2 / 180;
      return { x: CENTER.x + 164 * Math.cos(angle), y: CENTER.y + 164 * Math.sin(angle) };
    });
    points[points.length - 1] = points[0];
    return points;
  }
  if (id === 'heart') {
    const path = Array.from({ length: 241 }, (_, i) => {
      const t = i * Math.PI * 2 / 240;
      return {
        x: CENTER.x + 12 * 16 * Math.sin(t) ** 3,
        y: CENTER.y - 12 * (13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t))
      };
    });
    path[path.length - 1] = path[0];
    return path;
  }
  if (id === 'infinity') {
    const path = Array.from({ length: 241 }, (_, i) => {
      const t = i * Math.PI * 2 / 240;
      return { x: CENTER.x + 225 * Math.sin(t), y: CENTER.y + 132 * Math.sin(2*t) };
    });
    path[path.length - 1] = path[0];
    return path;
  }
  let vertices;
  if (id === 'triangle') {
    vertices = [
      { x: 450, y: 102 }, { x: 625, y: 405 }, { x: 275, y: 405 }
    ];
  } else if (id === 'square') {
    vertices = [
      { x: 295, y: 125 }, { x: 605, y: 125 },
      { x: 605, y: 435 }, { x: 295, y: 435 }
    ];
  } else if (id === 'diamond') {
    vertices = [
      { x: 450, y: 90 }, { x: 670, y: 280 },
      { x: 450, y: 470 }, { x: 230, y: 280 }
    ];
  } else if (id === 'hexagon') {
    vertices = Array.from({ length: 6 }, (_, i) => {
      const t = -Math.PI / 2 + i * Math.PI / 3;
      return { x: CENTER.x + 190 * Math.cos(t), y: CENTER.y + 190 * Math.sin(t) };
    });
  } else if (id === 'star') {
    vertices = Array.from({ length: 10 }, (_, i) => {
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const radius = i % 2 === 0 ? 185 : 87;
      return { x: CENTER.x + radius * Math.cos(a), y: CENTER.y + radius * Math.sin(a) };
    });
  } else {
    throw new Error(`Unknown level: ${id}`);
  }
  return [...vertices, vertices[0]];
}

export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));

export function pointSegmentDistance(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  if (length2 === 0) return distance(p, a);
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / length2, 0, 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function polylineLength(points) {
  return points.slice(1).reduce((sum, p, i) => sum + distance(p, points[i]), 0);
}

function distanceToPath(p, path) {
  let best = Infinity;
  for (let i = 1; i < path.length; i++) best = Math.min(best, pointSegmentDistance(p, path[i - 1], path[i]));
  return best;
}

export function samplePolyline(path, step = 6) {
  if (!path.length) return [];
  const samples = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const count = Math.max(1, Math.ceil(distance(a, b) / step));
    for (let j = 1; j <= count; j++) {
      const t = j / count;
      samples.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return samples;
}

// Symmetric check: precision measures user's deviation; coverage checks guide completion.
// Deliberately penalizes short arcs and excessively long scribbles.
export function evaluateDrawing(rawPoints, targetPath) {
  const empty = { score: 0, precision: 0, coverage: 0, length: 0, enough: false };
  if (!rawPoints || rawPoints.length < 4 || !targetPath || targetPath.length < 2) return empty;
  const length = polylineLength(rawPoints);
  if (length < 50) return { ...empty, length };
  const trace = samplePolyline(rawPoints, 7);
  const target = samplePolyline(targetPath, 7);
  const avgError = trace.reduce((sum, p) => sum + distanceToPath(p, targetPath), 0) / trace.length;
  const precision = clamp(1 - avgError / 52, 0, 1);
  const covered = target.reduce((n, p) => n + Number(distanceToPath(p, rawPoints) <= 22), 0);
  const coverage = covered / target.length;
  const targetLength = polylineLength(targetPath);
  const penalty = clamp((targetLength * 1.6) / Math.max(length, 1), 0, 1);
  const score = Math.round(100 * (0.57 * precision + 0.43 * coverage) * penalty);
  return { score: clamp(score, 0, 100), precision: Math.round(precision * 100), coverage: Math.round(coverage * 100), length: Math.round(length), enough: true };
}
