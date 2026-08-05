// Generates the Maplog app icon suite: an 8-bit CD on a starry dark field with
// a warm aura at the bottom — same suite feel as the official Soundmap icon
// (pixel-art hero element, dark sky, glow), but with a CD instead of a map.
// Usage: node scripts/generate-icon.mjs   (run from artifacts/maplog)
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const S = 512;            // master canvas
const PX = 16;            // pixel-art cell size (32x32 grid)
const GRID = S / PX;      // 32

// ── Palette ──────────────────────────────────────────────────────────────────
const BG_TOP = '#0b0b14';
const BG_BOTTOM = '#16080a';
const AURA = '#ff3c00';           // maplog primary
const AURA2 = '#ff7a3c';
// CD body: cool silver with an iridescent sheen wedge
const DISC = ['#cfd6e4', '#b9c2d6', '#a6b0c8'];
const SHEEN = ['#ffb18a', '#ff7a3c', '#ffd9a8'];  // warm sheen wedge (suite tie-in)
const SHEEN2 = ['#8ad2ff', '#b79cff'];            // cool sheen wedge
const HOLE_RING = '#e8edf7';
const STAR_COLORS = ['#ffd9a8', '#ffffff', '#ff9a66', '#9ad6ff'];

// deterministic PRNG so icons are reproducible
let seed = 1337;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

const rects = [];
const cell = (cx, cy, color, opacity = 1) =>
  rects.push(`<rect x="${cx * PX}" y="${cy * PX}" width="${PX}" height="${PX}" fill="${color}"${opacity < 1 ? ` fill-opacity="${opacity.toFixed(2)}"` : ''}/>`);

// ── 8-bit CD (centered slightly above middle) ────────────────────────────────
const CX = GRID / 2 - 0.5, CY = GRID / 2 - 1.5;   // grid-center of the disc
const R_OUT = 10.2, R_HOLE = 2.2, R_RING = 3.4;

for (let y = 0; y < GRID; y++) {
  for (let x = 0; x < GRID; x++) {
    const dx = x - CX, dy = y - CY;
    const d = Math.hypot(dx, dy);
    if (d > R_OUT || d < R_HOLE) continue;
    const ang = Math.atan2(dy, dx); // -PI..PI
    let color;
    if (d < R_RING) {
      color = HOLE_RING; // bright ring around the hub hole
    } else if (ang > -2.4 && ang < -1.2) {
      color = SHEEN[Math.floor(rnd() * SHEEN.length)];       // warm sheen (upper left)
    } else if (ang > 0.5 && ang < 1.35) {
      color = SHEEN2[Math.floor(rnd() * SHEEN2.length)];     // cool sheen (lower right)
    } else {
      color = DISC[Math.floor(rnd() * DISC.length)];
    }
    // darken toward the rim for depth
    cell(x, y, color, d > R_OUT - 1.2 ? 0.85 : 1);
    // data-groove rings so it reads as a CD, not a planet
    if ((d > 5.3 && d < 6.1) || (d > 7.6 && d < 8.3)) cell(x, y, '#6b7488', 0.35);
  }
}
// outer rim shadow cells (bottom edge)
for (let x = 0; x < GRID; x++) {
  for (let y = 0; y < GRID; y++) {
    const dx = x - CX, dy = y - CY;
    const d = Math.hypot(dx, dy);
    if (d <= R_OUT && d > R_OUT - 1.1 && dy > 3) cell(x, y, '#3a2a2f', 0.5);
  }
}

// ── Stars (avoid the disc area) ──────────────────────────────────────────────
const starCells = [];
for (let i = 0; i < 26; i++) {
  let x, y, tries = 0;
  do {
    x = Math.floor(rnd() * GRID);
    y = Math.floor(rnd() * (GRID - 6)); // keep out of the aura band
    tries++;
  } while (Math.hypot(x - CX, y - CY) < R_OUT + 1.6 && tries < 40);
  if (Math.hypot(x - CX, y - CY) < R_OUT + 1.6) continue;
  const c = STAR_COLORS[Math.floor(rnd() * STAR_COLORS.length)];
  const o = 0.35 + rnd() * 0.6;
  starCells.push(`<rect x="${x * PX + PX / 4}" y="${y * PX + PX / 4}" width="${PX / 2}" height="${PX / 2}" fill="${c}" fill-opacity="${o.toFixed(2)}"/>`);
  // a few bigger "plus" stars
  if (i % 7 === 0) {
    starCells.push(`<rect x="${x * PX - PX / 4}" y="${y * PX + PX / 4}" width="${PX * 1.5}" height="${PX / 2}" fill="${c}" fill-opacity="${(o * 0.5).toFixed(2)}"/>`);
    starCells.push(`<rect x="${x * PX + PX / 4}" y="${y * PX - PX / 4}" width="${PX / 2}" height="${PX * 1.5}" fill="${c}" fill-opacity="${(o * 0.5).toFixed(2)}"/>`);
  }
}

const svg = (rounded) => `<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${BG_TOP}"/>
      <stop offset="0.72" stop-color="#120a12"/>
      <stop offset="1" stop-color="${BG_BOTTOM}"/>
    </linearGradient>
    <radialGradient id="aura" cx="0.5" cy="1.05" r="0.75">
      <stop offset="0" stop-color="${AURA}" stop-opacity="0.95"/>
      <stop offset="0.45" stop-color="${AURA2}" stop-opacity="0.5"/>
      <stop offset="1" stop-color="${AURA}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="discGlow" cx="0.5" cy="0.44" r="0.42">
      <stop offset="0.7" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="0.86" stop-color="#ffb18a" stop-opacity="0.14"/>
      <stop offset="1" stop-color="#ffb18a" stop-opacity="0"/>
    </radialGradient>
    ${rounded ? `<clipPath id="rc"><rect width="${S}" height="${S}" rx="${S * 0.22}"/></clipPath>` : ''}
  </defs>
  <g ${rounded ? 'clip-path="url(#rc)"' : ''}>
    <rect width="${S}" height="${S}" fill="url(#bg)"/>
    ${starCells.join('\n    ')}
    <rect width="${S}" height="${S}" fill="url(#discGlow)"/>
    ${rects.join('\n    ')}
    <rect width="${S}" height="${S}" fill="url(#aura)" opacity="0.85"/>
  </g>
</svg>`;

// favicon keeps its own rounded corners; PWA icons are square (maskable-safe:
// the disc sits well inside the safe zone) and iOS rounds them itself.
writeFileSync('public/favicon.svg', svg(true));
await sharp(Buffer.from(svg(false))).resize(512, 512).png().toFile('public/icon-512.png');
await sharp(Buffer.from(svg(false))).resize(192, 192).png().toFile('public/icon-192.png');
await sharp(Buffer.from(svg(false))).resize(180, 180).png().toFile('public/apple-touch-icon.png');
console.log('icons written');
