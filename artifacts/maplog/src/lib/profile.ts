/** Editable collector profile — stored locally, like the collection itself. */

const KEY = 'maplog:profile';

export interface CollectorProfile {
  name: string;
  bio: string;
  /** Small data-URL avatar (downscaled before saving) */
  avatar: string | null;
}

export const DEFAULT_PROFILE: CollectorProfile = {
  name: 'Collector',
  bio: 'Soundmap Archive',
  avatar: null,
};

export function loadProfile(): CollectorProfile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        name: typeof p.name === 'string' && p.name.trim() ? p.name : DEFAULT_PROFILE.name,
        bio: typeof p.bio === 'string' ? p.bio : DEFAULT_PROFILE.bio,
        avatar: typeof p.avatar === 'string' ? p.avatar : null,
      };
    }
  } catch { /* corrupted — fall through */ }
  return { ...DEFAULT_PROFILE };
}

/** @returns false when persisting failed (e.g. storage quota exceeded) */
export function saveProfile(p: CollectorProfile): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}

/** Read an image file and downscale it to a square data-URL avatar. */
export function fileToAvatar(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas unavailable');
        // cover-crop to square
        const s = Math.min(img.width, img.height);
        const sx = (img.width - s) / 2;
        const sy = (img.height - s) / 2;
        ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image')); };
    img.src = url;
  });
}

// ── Collection valuation ──────────────────────────────────────────────────────

/** Flat per-card values by base rarity (no currency symbol by design). */
export const RARITY_VALUES: Record<string, number> = {
  common: 50,
  uncommon: 200,
  rare: 800,
};

/** Base rarity bucket for a rarity slug ('regular-uncommon' → 'uncommon'). */
export function rarityBucket(slug: string): string | null {
  if (slug.includes('uncommon')) return 'uncommon';
  if (slug.includes('common')) return 'common';
  if (slug.includes('rare')) return 'rare';
  return null; // epics / premium tiers unpriced for now
}
