// Regenerates the iOS PWA splash screens so they match the 8-bit CD app icon
// (they previously showed an old music-note placeholder).
// Renders the icon in a rounded tile, centered on the app background color.
// Usage: node scripts/generate-splash.mjs   (run from artifacts/maplog)
import sharp from 'sharp';

const BG = '#09090b';
// Sizes must match the <link rel="apple-touch-startup-image"> tags in index.html
const SIZES = [
  [640, 1136], [750, 1334], [1242, 2208], [1125, 2436], [828, 1792],
  [1242, 2688], [1170, 2532], [1284, 2778], [1179, 2556], [1290, 2796],
  [2048, 2732], [1668, 2388], [1668, 2224], [1488, 2266], [1536, 2048],
  [1640, 2360],
];

for (const [w, h] of SIZES) {
  const tile = Math.round(Math.min(w, h) * 0.34);
  const r = Math.round(tile * 0.22);
  const mask = Buffer.from(
    `<svg width="${tile}" height="${tile}"><rect width="${tile}" height="${tile}" rx="${r}" fill="#fff"/></svg>`,
  );
  const icon = await sharp('public/icon-512.png')
    .resize(tile, tile)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
  await sharp({ create: { width: w, height: h, channels: 4, background: BG } })
    .composite([{ input: icon, left: Math.round((w - tile) / 2), top: Math.round((h - tile) / 2) }])
    .png()
    .toFile(`public/splash/apple-splash-${w}x${h}.png`);
}
console.log(`wrote ${SIZES.length} splash screens`);
