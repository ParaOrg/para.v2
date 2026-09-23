// src/utils/geometry.ts

/**
 * Build an SVG path `d` for a direction cone.
 * @param cx,cy      apex position in SVG/user-space pixels
 * @param bearingDeg 0=N, 90=E
 * @param radiusPx   cone length
 * @param spreadDeg  full angular width of the cone
 */
export function conePath(
  cx: number,
  cy: number,
  bearingDeg: number,
  radiusPx: number,
  spreadDeg = 60
): string {
  const half = (spreadDeg / 2) * (Math.PI / 180);
  const b = (bearingDeg - 90) * (Math.PI / 180);
  const x1 = cx + radiusPx * Math.cos(b - half);
  const y1 = cy + radiusPx * Math.sin(b - half);
  const x2 = cx + radiusPx * Math.cos(b + half);
  const y2 = cy + radiusPx * Math.sin(b + half);
  return `M ${cx} ${cy} L ${x1} ${y1} A ${radiusPx} ${radiusPx} 0 0 1 ${x2} ${y2} Z`;
}

/**
 * Google-Maps-style cone opacity based on speed.
 * @param speedMps coords.speed in m/s, or null/undefined
 */
export function coneOpacity(speedMps: number | null | undefined): number {
  if (speedMps == null || Number.isNaN(speedMps)) return 0;
  if (speedMps < 1.5) return 0;
  if (speedMps < 8) return 0.35;
  return 0.5;
}
