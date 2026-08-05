import { useState, useEffect, useRef } from 'react';

/**
 * Module-level cache: artworkUrl → extracted color string.
 * Prevents re-running canvas extraction on every re-mount / page navigation.
 */
const artColorCache = new Map<string, string>();

/**
 * Samples a 40×40 downscale of the artwork and returns the most vibrant
 * (highly-saturated, mid-brightness) pixel color as an rgb() string.
 * Falls back to `fallback` on CORS failure or no image.
 */
function extractVibrantColor(img: CanvasImageSource): string {
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
 * Resolves asynchronously; starts as `fallback` (or the cached value if
 * we've already extracted from this URL — prevents re-flash on revisit).
 */
/**
 * Neutral color shown while extraction is pending on first sight of an
 * artwork. Starting from the rarity fallback made every card flash its
 * rarity color before "correcting" to the artwork color — starting neutral
 * makes the resolve read as a subtle fade-in instead.
 */
const PENDING_NEUTRAL = 'rgb(63,63,70)';

export function useArtColor(
  artworkUrl: string | null | undefined,
  fallback: string,
): string {
  // Initialise directly from cache so the card renders at its final color
  // on revisit with no visible transition.
  const [color, setColor] = useState<string>(() => {
    if (artworkUrl && artColorCache.has(artworkUrl)) {
      return artColorCache.get(artworkUrl)!;
    }
    // No artwork → rarity fallback immediately; otherwise neutral until
    // extraction resolves (fallback only applies on failure).
    return artworkUrl ? PENDING_NEUTRAL : fallback;
  });

  // Keep a ref to avoid closure issues inside the img callback
  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;

  useEffect(() => {
    if (!artworkUrl) {
      setColor(fallback);
      return;
    }

    // Already cached — apply immediately without spawning an Image
    if (artColorCache.has(artworkUrl)) {
      setColor(artColorCache.get(artworkUrl)!);
      return;
    }

    // New, uncached artwork — hold neutral while extraction runs
    setColor(PENDING_NEUTRAL);

    let cancelled = false;

    // Use fetch + createImageBitmap instead of an <img> element. Safari
    // sometimes serves a cached non-CORS copy of the same artwork URL to a
    // crossOrigin <img> (the artwork is also rendered as a plain <img>
    // elsewhere), which taints the canvas and made every card fall back to
    // its rarity color. A CORS-mode fetch has its own cache entry and always
    // yields readable pixels.
    (async () => {
      try {
        const res = await fetch(artworkUrl, { mode: 'cors' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        let extracted = '';
        if (typeof createImageBitmap === 'function') {
          const bitmap = await createImageBitmap(blob);
          if (cancelled) { bitmap.close(); return; }
          extracted = extractVibrantColor(bitmap);
          bitmap.close();
        } else {
          // Older Safari fallback: decode via an <img> from a same-origin
          // blob URL (never taints the canvas).
          const objectUrl = URL.createObjectURL(blob);
          try {
            const img = new Image();
            img.src = objectUrl;
            await img.decode();
            if (cancelled) return;
            extracted = extractVibrantColor(img);
          } finally {
            URL.revokeObjectURL(objectUrl);
          }
        }
        if (extracted) {
          // Only cache successful extractions — a transient failure shouldn't
          // pin the fallback color for the rest of the session.
          artColorCache.set(artworkUrl, extracted);
          if (!cancelled) setColor(extracted);
        } else if (!cancelled) {
          setColor(fallbackRef.current);
        }
      } catch {
        if (!cancelled) setColor(fallbackRef.current);
      }
    })();

    return () => { cancelled = true; };
  }, [artworkUrl]); // fallback is stable per slug, ref handles any change

  return color;
}
