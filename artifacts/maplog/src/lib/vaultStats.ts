import type { MaplogSong, MaplogCard } from './types';
import { ensureCardTags, labelForTags, normalizeTags } from './tags';
import { cardValue } from './profile';

/**
 * Vault stats engine — reusable selectors that compute value/count
 * aggregations over arbitrary tag/artist filters. Powers the Vault graphs,
 * rankings, and (later) artist-page pre-filtered views.
 */

export interface VaultEntry {
  card: MaplogCard;
  tags: string[];
  /** Human label for the tag pool, e.g. "Shiny Rare" */
  label: string;
  /** null when the card's base rarity is unpriced (epics etc.) */
  value: number | null;
  trackId: string;
  title: string;
  artist: string;
  artworkUrl: string | null;
}

export interface VaultFilter {
  /** Every listed tag must be present on the card (canonicalized). */
  tags?: string[];
  /** Case-insensitive exact artist match. */
  artist?: string;
}

/** Flatten the collection into one row per card with tags + value resolved. */
export function vaultEntries(songs: MaplogSong[]): VaultEntry[] {
  const out: VaultEntry[] = [];
  for (const song of songs) {
    for (const raw of song.cards) {
      const card = ensureCardTags(raw);
      const tags = card.tags ?? [];
      out.push({
        card,
        tags,
        // All epics group under one "Epic" label in valuation breakdowns —
        // their individual value comes from their number, not a sub-tier.
        label: card.rarityType.slug.includes('epic')
          ? 'Epic'
          : tags.length > 0 ? labelForTags(tags) : card.rarityType.name,
        value: cardValue(card),
        trackId: song.id,
        title: song.title,
        artist: song.artist,
        artworkUrl: card.artworkUrl ?? song.artworkUrl ?? null,
      });
    }
  }
  return out;
}

export function filterEntries(entries: VaultEntry[], filter?: VaultFilter): VaultEntry[] {
  if (!filter) return entries;
  const wanted = filter.tags ? normalizeTags(filter.tags) : [];
  const artist = filter.artist?.trim().toLowerCase();
  return entries.filter(e => {
    if (wanted.length > 0 && !wanted.every(t => e.tags.includes(t))) return false;
    if (artist && e.artist.trim().toLowerCase() !== artist) return false;
    return true;
  });
}

export interface LabelBreakdown {
  label: string;
  count: number;
  value: number;
}

export interface Ranking {
  key: string;
  /** Artist name, or track title for track rankings */
  name: string;
  /** Secondary line (artist for tracks) */
  sub?: string;
  artworkUrl: string | null;
  count: number;
  value: number;
}

export interface VaultStats {
  totalCards: number;
  totalTracks: number;
  /** Sum of card values (unpriced cards contribute 0) */
  totalValue: number;
  /** Cards with no priced base rarity (epics etc.) */
  unpricedCount: number;
  /** Value + count per tag-pool label, sorted by value desc */
  byLabel: LabelBreakdown[];
  topArtists: Ranking[];
  topTracks: Ranking[];
}

export function computeVaultStats(
  songs: MaplogSong[],
  filter?: VaultFilter,
  limit = 5,
): VaultStats {
  return computeVaultStatsFromEntries(vaultEntries(songs), filter, limit);
}

/** Aggregate over pre-flattened entries — memoize `vaultEntries` and reuse. */
export function computeVaultStatsFromEntries(
  allEntries: VaultEntry[],
  filter?: VaultFilter,
  limit = 5,
): VaultStats {
  const entries = filterEntries(allEntries, filter);

  let totalValue = 0;
  let unpricedCount = 0;
  const byLabel = new Map<string, LabelBreakdown>();
  const byArtist = new Map<string, Ranking>();
  const byTrack = new Map<string, Ranking>();
  const trackIds = new Set<string>();

  for (const e of entries) {
    const v = e.value ?? 0;
    if (e.value == null) unpricedCount += 1;
    totalValue += v;
    trackIds.add(e.trackId);

    const lb = byLabel.get(e.label) ?? { label: e.label, count: 0, value: 0 };
    lb.count += 1; lb.value += v;
    byLabel.set(e.label, lb);

    const ak = e.artist.trim().toLowerCase();
    const ar = byArtist.get(ak) ?? { key: ak, name: e.artist, sub: undefined, artworkUrl: e.artworkUrl, count: 0, value: 0 };
    ar.count += 1; ar.value += v;
    if (!ar.artworkUrl && e.artworkUrl) ar.artworkUrl = e.artworkUrl;
    byArtist.set(ak, ar);

    const tr = byTrack.get(e.trackId) ?? { key: e.trackId, name: e.title, sub: e.artist, artworkUrl: e.artworkUrl, count: 0, value: 0 };
    tr.count += 1; tr.value += v;
    byTrack.set(e.trackId, tr);
  }

  const desc = (a: { value: number; count: number }, b: { value: number; count: number }) =>
    b.value - a.value || b.count - a.count;

  return {
    totalCards: entries.length,
    totalTracks: trackIds.size,
    totalValue,
    unpricedCount,
    byLabel: [...byLabel.values()].sort(desc),
    topArtists: [...byArtist.values()].sort(desc).slice(0, limit),
    topTracks: [...byTrack.values()].sort(desc).slice(0, limit),
  };
}
