import type { MaplogRarityType } from './types';
import { LINKABLE_RARITY_TIERS } from './rarityMap';

/**
 * Per-rarity Apple Music playlist links, persisted in localStorage.
 * Each base rarity (Common/Uncommon/Rare) can be linked to one playlist;
 * "Refresh all" re-syncs the collection against every linked playlist.
 */

const LINKS_KEY = 'maplog:playlistLinks';

export interface PlaylistLink {
  raritySlug:  string;
  url:         string;
  name:        string;
  trackCount:  number;
  artworkUrl:  string | null;
  lastSynced:  string | null; // ISO timestamp
  /**
   * For tag-based links (key = `tags:<sorted-joined>`): the exact tag set
   * applied to imported cards. Absent on legacy rarity-slug links.
   */
  tags?: string[];
}

export type PlaylistLinks = Record<string, PlaylistLink>; // keyed by rarity slug or tags:<sorted>

export function loadPlaylistLinks(): PlaylistLinks {
  try {
    const raw = localStorage.getItem(LINKS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function savePlaylistLinks(links: PlaylistLinks): void {
  localStorage.setItem(LINKS_KEY, JSON.stringify(links));
}

/** The rarities that can carry a playlist link (base + shiny tiers). */
export const LINKABLE_RARITIES: MaplogRarityType[] = LINKABLE_RARITY_TIERS;

/** Fetch + normalize a playlist via the API server. */
export async function fetchPlaylist(url: string): Promise<{ name: string; songs: import('./types').MaplogSong[] }> {
  const res = await fetch(`/api/apple-music/playlist?url=${encodeURIComponent(url.trim())}`);
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error ?? 'Could not load the playlist.');
  const songs = (data.songs ?? []).map((t: any) => ({
    id: `apple:${t.id}`,
    source: 'apple' as const,
    title: t.title,
    artist: t.artist,
    album: t.album,
    genre: t.genre ?? null,
    durationMs: t.durationMs ?? 0,
    artworkUrl: t.artworkUrl ?? '',
    previewUrl: t.previewUrl ?? null,
    cards: [],
  }));
  return { name: data.name, songs };
}
