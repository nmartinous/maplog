import type { MaplogCard } from './types';

/**
 * Card templates — reusable frame/pattern/background definitions for the
 * special rarities (epics, moments, lyrics, radiants), modeled on the user's
 * Soundmap reference captures. New variants only need a template entry here.
 */

// ── Presence routing ──────────────────────────────────────────────────────────

export type CardPresence = 'regular' | 'epic' | 'radiant' | 'lyrics' | 'moment';

/** Which rendering engine a card uses (tags first, legacy slug fallback). */
export function presenceForCard(card: MaplogCard): CardPresence {
  const tags = card.tags ?? [];
  for (const p of ['epic', 'radiant', 'lyrics', 'moment'] as const) {
    if (tags.includes(p)) return p;
  }
  if (tags.includes('regular')) return 'regular';
  const slug = card.rarityType.slug;
  if (slug.includes('epic') || slug === 'special-edition') return 'epic';
  if (slug === 'radiant') return 'radiant';
  if (slug === 'lyric') return 'lyrics';
  if (slug === 'moment') return 'moment';
  return 'regular';
}

// ── Epic frames ───────────────────────────────────────────────────────────────
// A frame draws OVER the media slot (border treatment + optional corner art).

export interface EpicFrame {
  id: string;
  label: string;
  /** CSS border-image-ish gradient for the card border */
  borderGradient: string;
  /** Soft outer glow color */
  glow: string;
}

export const EPIC_FRAMES: Record<string, EpicFrame> = {
  default: {
    id: 'default', label: 'Epic',
    borderGradient: 'linear-gradient(140deg,#f5d67b 0%,#e9a13b 30%,#f8e3a1 50%,#c97b23 75%,#f5d67b 100%)',
    glow: '#e9a13b',
  },
  streak: {
    id: 'streak', label: 'Streak',
    borderGradient: 'linear-gradient(160deg,#ff8a00 0%,#ff3c00 35%,#ffb347 55%,#ff3c00 80%,#ff8a00 100%)',
    glow: '#ff5a1f',
  },
  pridemap: {
    id: 'pridemap', label: 'PrideMap',
    borderGradient: 'linear-gradient(90deg,#e40303,#ff8c00,#ffed00,#008026,#004dff,#750787)',
    glow: '#ff8c00',
  },
  coachella: {
    id: 'coachella', label: 'Coachella',
    borderGradient: 'linear-gradient(140deg,#ff5ea8 0%,#ffb14e 40%,#3ec3ff 75%,#ff5ea8 100%)',
    glow: '#ff5ea8',
  },
  summersplash: {
    id: 'summersplash', label: 'Summer Splash',
    borderGradient: 'linear-gradient(140deg,#38bdf8 0%,#22d3ee 35%,#fde68a 65%,#38bdf8 100%)',
    glow: '#22d3ee',
  },
};

// ── Epic border kinds (typed playlists) ───────────────────────────────────────

/**
 * Visual border variant for typed epic cards imported via the four epic
 * playlists (common / uncommon / rare = numbered with coloured neon border;
 * unnumbered = no border).  All other epic slugs (legacy, special, streak…)
 * fall through to 'unnumbered' so they keep their existing gold frame.
 */
export type EpicBorderKind = 'common' | 'uncommon' | 'rare' | 'unnumbered';

export function epicBorderKind(card: MaplogCard): EpicBorderKind {
  switch (card.rarityType.slug) {
    case 'epic-common':    return 'common';
    case 'epic-uncommon':  return 'uncommon';
    case 'epic-rare':      return 'rare';
    case 'epic-unnumbered':
    default:               return 'unnumbered';
  }
}

/** Pick the frame for an epic card from its override tags. */
export function epicFrameForCard(card: MaplogCard): EpicFrame {
  const tags = card.tags ?? [];
  for (const key of Object.keys(EPIC_FRAMES)) {
    if (key !== 'default' && tags.includes(key)) return EPIC_FRAMES[key];
  }
  if (card.rarityType.slug === 'streak-epic') return EPIC_FRAMES.streak;
  return EPIC_FRAMES.default;
}

// ── Radiant patterns ──────────────────────────────────────────────────────────
// Reusable SVG tile templates rendered as data-URI backgrounds, tinted with
// the auto-extracted art color. A new radiant only needs a pattern choice.

export interface RadiantPattern {
  id: string;
  label: string;
  /** Build the SVG tile — `c` is the tint color (any CSS color) */
  svg: (c: string) => string;
  tileSize: number;
}

const enc = (s: string) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;

export const RADIANT_PATTERNS: Record<string, RadiantPattern> = {
  prism: {
    id: 'prism', label: 'Prism', tileSize: 48,
    svg: c => `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'><path d='M24 4 44 24 24 44 4 24Z' fill='none' stroke='${c}' stroke-width='1.5' opacity='0.8'/><path d='M24 14 34 24 24 34 14 24Z' fill='none' stroke='${c}' stroke-width='1' opacity='0.5'/></svg>`,
  },
  waves: {
    id: 'waves', label: 'Waves', tileSize: 56,
    svg: c => `<svg xmlns='http://www.w3.org/2000/svg' width='56' height='28'><path d='M0 14 Q14 0 28 14 T56 14' fill='none' stroke='${c}' stroke-width='1.5' opacity='0.7'/><path d='M0 24 Q14 10 28 24 T56 24' fill='none' stroke='${c}' stroke-width='1' opacity='0.4'/></svg>`,
  },
  orbits: {
    id: 'orbits', label: 'Orbits', tileSize: 64,
    svg: c => `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><circle cx='32' cy='32' r='24' fill='none' stroke='${c}' stroke-width='1.2' opacity='0.6'/><circle cx='32' cy='32' r='12' fill='none' stroke='${c}' stroke-width='1' opacity='0.4'/><circle cx='56' cy='32' r='2.5' fill='${c}' opacity='0.8'/></svg>`,
  },
  sparks: {
    id: 'sparks', label: 'Sparks', tileSize: 44,
    svg: c => `<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44'><path d='M22 8 24.5 19.5 36 22 24.5 24.5 22 36 19.5 24.5 8 22 19.5 19.5Z' fill='${c}' opacity='0.7'/><circle cx='8' cy='38' r='1.5' fill='${c}' opacity='0.5'/></svg>`,
  },
};

export const DEFAULT_RADIANT_PATTERN = 'prism';

/** CSS background value for a radiant pattern tinted with `color`. */
export function radiantPatternCss(patternId: string | null | undefined, color: string): { backgroundImage: string; backgroundSize: string } {
  const p = RADIANT_PATTERNS[patternId ?? ''] ?? RADIANT_PATTERNS[DEFAULT_RADIANT_PATTERN];
  return { backgroundImage: enc(p.svg(color)), backgroundSize: `${p.tileSize}px ${p.tileSize}px` };
}
