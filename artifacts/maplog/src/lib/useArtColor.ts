import { useState, useEffect } from 'react';

/**
 * Samples a 40×40 downscale of the artwork and returns the most vibrant
 * (highly-saturated, mid-brightness) pixel color as an rgb() string.
 * Falls back to `fallback` on CORS failure or no image.
 */
function extractVibrantColor(img: HTMLImageElement): string {
  try {
    const size = 40;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    let bestR = 0, bestG = 0, bestB = 0, bestScore = -1;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a < 200) continue; // skip transparent

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max === 0) continue;

      const sat = (max - min) / max;          // 0–1, higher = more colorful
      const bri = max / 255;                  // 0–1, higher = brighter

      // Prefer high saturation, mid-range brightness (not black, not washed out)
      const score = sat * Math.pow(bri, 0.5) * (1 - Math.abs(bri - 0.55) * 0.8);

      if (score > bestScore) {
        bestScore = score;
        bestR = r; bestG = g; bestB = b;
      }
    }

    if (bestScore < 0) return '';
    return `rgb(${bestR},${bestG},${bestB})`;
  } catch {
    // Canvas tainted (CORS) — silently return empty
    return '';
  }
}

/**
 * Hook: returns the vibrant color extracted from `artworkUrl`.
 * Resolves asynchronously; starts as `fallback`.
 */
export function useArtColor(
  artworkUrl: string | null | undefined,
  fallback: string,
): string {
  const [color, setColor] = useState(fallback);

  useEffect(() => {
    if (!artworkUrl) {
      setColor(fallback);
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      if (cancelled) return;
      const extracted = extractVibrantColor(img);
      setColor(extracted || fallback);
    };
    img.onerror = () => {
      if (!cancelled) setColor(fallback);
    };

    img.src = artworkUrl;
    return () => { cancelled = true; };
  }, [artworkUrl, fallback]);

  return color;
}
