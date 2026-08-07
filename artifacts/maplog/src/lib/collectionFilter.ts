/**
 * Shared collection-filter logic.
 *
 * Collection.tsx persists its active filter to sessionStorage so the detail
 * pages (SongDetail / CardView) can navigate within the same filtered list
 * via vertical swipes (TikTok-style).
 */
import type { MaplogSong } from './types';

export interface CollectionFilter {
  search: string;
  scope: 'all' | 'song' | 'artist' | 'album' | string;
  activeRarity: string;
}

const KEY = 'maplog:collection:filter';

export function readCollectionFilter(): CollectionFilter {
  try {
    return (
      JSON.parse(sessionStorage.getItem(KEY) ?? 'null') ??
      { search: '', scope: 'all', activeRarity: 'All' }
    );
  } catch {
    return { search: '', scope: 'all', activeRarity: 'All' };
  }
}

export function isFilterActive(f: CollectionFilter): boolean {
  return f.search !== '' || f.activeRarity !== 'All';
}

export function applyCollectionFilter(songs: MaplogSong[], f: CollectionFilter): MaplogSong[] {
  const { search, scope, activeRarity } = f;
  if (!search && activeRarity === 'All') return songs;
  const q = search.toLowerCase();
  return songs.filter(s => {
    if (q) {
      const inTitle  = s.title.toLowerCase().includes(q);
      const inArtist = s.artist.toLowerCase().includes(q);
      const inAlbum  = (s.album ?? '').toLowerCase().includes(q);
      const match = scope === 'song'   ? inTitle
                  : scope === 'artist' ? inArtist
                  : scope === 'album'  ? inAlbum
                  : inTitle || inArtist || inAlbum;
      if (!match) return false;
    }
    if (activeRarity !== 'All' && !s.cards.some(c => c.rarityType.category === activeRarity)) return false;
    return true;
  });
}
