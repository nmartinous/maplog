import type { MaplogSong } from './types';

/**
 * User-created playlists: named, ordered lists of songs from the collection.
 * Only song ids are stored — songs render from whatever is currently in the
 * collection, so removed songs silently drop out.
 */

const KEY = 'maplog:userPlaylists';

export interface UserPlaylist {
  id: string;
  name: string;
  songIds: string[];
  createdAt: string; // ISO
}

export function loadUserPlaylists(): UserPlaylist[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveUserPlaylists(lists: UserPlaylist[]): void {
  localStorage.setItem(KEY, JSON.stringify(lists));
}

export function newPlaylistId(): string {
  return `pl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Resolve a playlist's song ids against the current collection (drops missing). */
export function resolveSongs(list: UserPlaylist, collection: MaplogSong[]): MaplogSong[] {
  const byId = new Map(collection.map(s => [s.id, s]));
  return list.songIds.map(id => byId.get(id)).filter((s): s is MaplogSong => !!s);
}
