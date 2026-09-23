// src/components/contribute/buildConeSvg.ts
// Direction beam — small trapezoid attached tangent to the top of the GPS circle.
// - Near edge = circle diameter, sits tangent to the top of the circle
// - Far edge wider than near edge (trapezoid flare)
// - Gradient runs near -> far: transparent at circle, opaque at tip
// - Soft edges via SVG blur

export function buildConeSvg(facingDeg: number, circleRadius = 10): string {
  const uid = Math.random().toString(36).slice(2, 8);
  const gradId = `pcg-${uid}`;
  const filterId = `pcf-${uid}`;

  const SVG_W = 60;
  const SVG_H = 60;
  const cx = SVG_W / 2;
  const cy = SVG_H / 2;   // SVG center; this maps to the GPS point

  const R = circleRadius;
  const LENGTH = R * 1.5;      // 15px for R = 10
  const FLARE_PER_SIDE = 4;    // far edge is 8px wider than near edge (total)

  // Near edge = tangent to top of circle
  const nearY = cy - R;
  const farY = nearY - LENGTH;

  // Near edge x-range (matches circle diameter)
  const nearLeftX = cx - R;
  const nearRightX = cx + R;

  // Far edge x-range (flared outward)
  const farLeftX = nearLeftX - FLARE_PER_SIDE;
  const farRightX = nearRightX + FLARE_PER_SIDE;

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_W}" height="${SVG_H}" viewBox="0 0 ${SVG_W} ${SVG_H}" style="pointer-events:none;">
  <defs>
    <linearGradient id="${gradId}" x1="${cx}" y1="${nearY}" x2="${cx}" y2="${farY}" gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="#7A4BC8" stop-opacity="0.55"/>
      <stop offset="55%"  stop-color="#7A4BC8" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="#7A4BC8" stop-opacity="0"/>
    </linearGradient>
    <filter id="${filterId}" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="1.6"/>
    </filter>
  </defs>

  <g transform="rotate(${facingDeg} ${cx} ${cy})">
    <path d="M ${nearLeftX} ${nearY}
             L ${farLeftX} ${farY}
             L ${farRightX} ${farY}
             L ${nearRightX} ${nearY}
             Z"
          fill="url(#${gradId})"
          filter="url(#${filterId})"/>
  </g>
</svg>
  `.trim();
}
