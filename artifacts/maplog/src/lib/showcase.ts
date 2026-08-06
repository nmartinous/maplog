import type { MaplogSong, MaplogCard } from './types';
import { presenceForCard } from './cardTemplates';
import { artistKey } from './badges';

/**
 * Showcase — user-arranged rows of special (non-regular) cards, shown on the
 * Profile page and per-artist pages. Rows have a layout and an ordered list
 * of card ids; cards are resolved against the live collection so removed
 * cards silently drop out. Stored in `maplog:showcase` (the export/import
 * backup should include this key).
 */

export type ShowcaseLayout = 'hero' | 'duo' | 'trio' | 'strip';

export interface ShowcaseRow {
  id: string;
  layout: ShowcaseLayout;
  cardIds: string[];
}

export const LAYOUT_SLOTS: Record<ShowcaseLayout, number> = {
  hero: 1,   // one large card
  duo: 2,    // two medium cards
  trio: 3,   // three small cards
  strip: 6,  // horizontal scroll strip (up to 6)
};

export const LAYOUT_LABELS: Record<ShowcaseLayout, string> = {
  hero: 'Hero — one large card',
  duo: 'Duo — two cards',
  trio: 'Trio — three cards',
  strip: 'Strip — scrolling row',
};

interface ShowcaseStore {
  profile: ShowcaseRow[];
  artists: Record<string, ShowcaseRow[]>;
}

const KEY = 'maplog:showcase';

let cache: ShowcaseStore | null = null;

function loadStore(): ShowcaseStore {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    cache = parsed && typeof parsed === 'object'
      ? { profile: parsed.profile ?? [], artists: parsed.artists ?? {} }
      : { profile: [], artists: {} };
  } catch {
    cache = { profile: [], artists: {} };
  }
  return cache;
}

function saveStore(store: ShowcaseStore): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
    cache = store; // only commit the in-memory cache once the write succeeded
    return true;
  } catch {
    return false;
  }
}

/** Scope: 'profile' or an artist name. */
export type ShowcaseScope = { kind: 'profile' } | { kind: 'artist'; artist: string };

export function loadShowcaseRows(scope: ShowcaseScope): ShowcaseRow[] {
  const store = loadStore();
  return scope.kind === 'profile'
    ? store.profile
    : store.artists[artistKey(scope.artist)] ?? [];
}

export function saveShowcaseRows(scope: ShowcaseScope, rows: ShowcaseRow[]): boolean {
  const store = loadStore();
  const next: ShowcaseStore = scope.kind === 'profile'
    ? { ...store, profile: rows }
    : { ...store, artists: { ...store.artists, [artistKey(scope.artist)]: rows } };
  return saveStore(next);
}

export function newRowId(): string {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** A card + its song, resolved from the collection. */
export interface ShowcaseCardRef {
  card: MaplogCard;
  song: MaplogSong;
}

/** All showcase-eligible cards (non-regular presences), optionally per artist. */
export function eligibleCards(songs: MaplogSong[], artist?: string): ShowcaseCardRef[] {
  const key = artist ? artistKey(artist) : null;
  const out: ShowcaseCardRef[] = [];
  for (const song of songs) {
    if (key && artistKey(song.artist) !== key) continue;
    for (const card of song.cards) {
      if (presenceForCard(card) !== 'regular') out.push({ card, song });
    }
  }
  return out;
}

/** Resolve a row's card ids against the collection (missing cards drop out). */
export function resolveRow(row: ShowcaseRow, songs: MaplogSong[]): ShowcaseCardRef[] {
  const index = new Map<string, ShowcaseCardRef>();
  for (const song of songs) {
    for (const card of song.cards) index.set(card.id, { card, song });
  }
  return row.cardIds
    .map(id => index.get(id))
    .filter((r): r is ShowcaseCardRef => !!r);
}
