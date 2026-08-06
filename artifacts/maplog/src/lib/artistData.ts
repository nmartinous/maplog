import { artistKey } from './badges';

/**
 * Per-artist user content + imported Apple Music info, keyed by artistKey
 * (lowercased trimmed artist name) in `maplog:artistData`. The export/import
 * (backup) feature should include this key.
 */

export interface ImportedArtistInfo {
  imageUrl: string | null;
  genres: string[];
  url: string | null;
  fetchedAt: string;
}

export interface ArtistData {
  /** User-chosen image (data URL or remote URL); falls back to imported */
  imageUrl?: string | null;
  /** User-chosen lyric used as the artist "bio" */
  lyricBio?: string | null;
  /** Freeform user notes */
  notes?: string | null;
  /** Auto-imported Apple Music info */
  imported?: ImportedArtistInfo | null;
}

const KEY = 'maplog:artistData';

type ArtistDataMap = Record<string, ArtistData>;

let cache: ArtistDataMap | null = null;

function loadAll(): ArtistDataMap {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as ArtistDataMap) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function saveAll(map: ArtistDataMap): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
    cache = map; // only commit the in-memory cache once the write succeeded
    return true;
  } catch {
    return false; // storage full — caller decides how to surface it
  }
}

export function loadArtistData(artist: string): ArtistData {
  return loadAll()[artistKey(artist)] ?? {};
}

export function saveArtistData(artist: string, patch: Partial<ArtistData>): boolean {
  const map = { ...loadAll() };
  const key = artistKey(artist);
  map[key] = { ...map[key], ...patch };
  return saveAll(map);
}

/** How stale imported info may get before we re-fetch (7 days). */
const IMPORT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function importedInfoIsFresh(data: ArtistData): boolean {
  if (!data.imported) return false;
  const age = Date.now() - new Date(data.imported.fetchedAt).getTime();
  return Number.isFinite(age) && age < IMPORT_TTL_MS;
}

/**
 * Fetch Apple Music artist info via the API proxy and persist it.
 * Returns the imported info, or null when the artist wasn't found /
 * the request failed (existing imported data is left untouched).
 */
export async function importArtistInfo(artist: string): Promise<ImportedArtistInfo | null> {
  try {
    // Same root-relative /api convention as the rest of the app
    const res = await fetch(`/api/apple-music/artist?name=${encodeURIComponent(artist)}`);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.error) return null;
    const info: ImportedArtistInfo = {
      imageUrl: json.imageUrl ?? null,
      genres: Array.isArray(json.genres) ? json.genres : [],
      url: json.url ?? null,
      fetchedAt: new Date().toISOString(),
    };
    // Only report imported info when it was durably persisted — otherwise the
    // UI would show data that vanishes on reload (and re-fetch next visit).
    return saveArtistData(artist, { imported: info }) ? info : null;
  } catch {
    return null;
  }
}
