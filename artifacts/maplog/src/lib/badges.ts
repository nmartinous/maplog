/**
 * Artist badges — accomplishment badges assigned per artist, for display on
 * future artist pages. Stored locally like everything else.
 */

const KEY = 'maplog:artistBadges';

export const BADGE_TIERS = [
  'bronze', 'silver', 'gold', 'platinum', 'diamond', 'legendary',
  'vip', 'shiny', 'radiant',
] as const;
export type BadgeTier = typeof BADGE_TIERS[number];

export const BADGE_LABELS: Record<BadgeTier, string> = {
  bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum',
  diamond: 'Diamond', legendary: 'Legendary', vip: 'VIP', shiny: 'Shiny', radiant: 'Radiant',
};

export const BADGE_COLORS: Record<BadgeTier, string> = {
  bronze:    '#b08d57',
  silver:    '#c0c0c8',
  gold:      '#e6b800',
  platinum:  '#a7f3d0',
  diamond:   '#7dd3fc',
  legendary: '#f97316',
  vip:       '#f472b6',
  shiny:     '#e879f9',
  radiant:   '#a78bfa',
};

/** artistKey (lowercased trimmed name) → assigned badge tiers */
export type ArtistBadgeMap = Record<string, BadgeTier[]>;

export function artistKey(artist: string): string {
  return artist.trim().toLowerCase();
}

export function loadArtistBadges(): ArtistBadgeMap {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function saveArtistBadges(map: ArtistBadgeMap): void {
  localStorage.setItem(KEY, JSON.stringify(map));
}

export function badgesForArtist(artist: string, map: ArtistBadgeMap = loadArtistBadges()): BadgeTier[] {
  return map[artistKey(artist)] ?? [];
}

export function toggleArtistBadge(artist: string, tier: BadgeTier): ArtistBadgeMap {
  const map = loadArtistBadges();
  const key = artistKey(artist);
  const current = map[key] ?? [];
  const next = current.includes(tier) ? current.filter(t => t !== tier) : [...current, tier];
  if (next.length === 0) delete map[key];
  else map[key] = BADGE_TIERS.filter(t => next.includes(t)); // stable tier order
  saveArtistBadges(map);
  return map;
}
