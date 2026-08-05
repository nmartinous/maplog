/**
 * MusicKitContext — collection backed by localStorage, catalog powered by
 * Apple Music. Search hits the Apple Music catalog via the API server proxy;
 * MusicKit JS handles user authorization for full-song playback (30-second
 * Apple previews remain the fallback for unauthorized sessions).
 * Keeps the same MusicKitProvider / useMusicKit exports so all consumers need zero changes.
 */

import React, {
  createContext, useContext, useState, useCallback, useEffect,
} from 'react';
import type { MaplogSong, MaplogCard, MaplogRarityType } from '@/lib/types';
import { DEMO_SONGS } from '@/lib/demoData';
import { initMusicKit } from '@/lib/musicKit';

// ── Constants ──────────────────────────────────────────────────────────────────

const COLLECTION_KEY = 'maplog:collection';
const DEMO_MODE_KEY  = 'maplog:demoMode';

// ── Apple Music catalog search (via API proxy) ─────────────────────────────────

async function appleSearch(query: string): Promise<MaplogSong[]> {
  if (!query.trim()) return [];
  const res = await fetch(`/api/apple-music/search?q=${encodeURIComponent(query)}&limit=25`);
  if (!res.ok) throw new Error('Search failed — please try again.');
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return (data.data ?? []).map((t: any): MaplogSong => ({
    // Prefixed to avoid collisions with legacy Deezer numeric IDs
    id:         `apple:${t.id}`,
    source:     'apple',
    title:      t.title,
    artist:     t.artist,
    album:      t.album,
    genre:      t.genre ?? null,
    durationMs: t.durationMs ?? 0,
    artworkUrl: t.artworkUrl ?? '',
    previewUrl: t.previewUrl ?? null,
    cards:      [],
  }));
}

// ── Local storage helpers ──────────────────────────────────────────────────────

function loadCollection(): MaplogSong[] {
  try {
    const raw = localStorage.getItem(COLLECTION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCollection(songs: MaplogSong[]): void {
  localStorage.setItem(COLLECTION_KEY, JSON.stringify(songs));
}

// ── Context types ──────────────────────────────────────────────────────────────

export interface MusicKitContextType {
  /** Whether the developer token was fetched and MusicKit configured */
  hasToken:     boolean;
  isReady:      boolean;
  /** Whether the user has connected their Apple Music subscription (full-song playback) */
  isAuthorized: boolean;
  isLoading:    boolean;
  error:        string | null;
  songs:        MaplogSong[];
  getSong:      (id: string) => MaplogSong | undefined;

  /** Search the Apple Music catalog (name kept for interface compatibility) */
  searchDeezer: (query: string) => Promise<MaplogSong[]>;

  /** Add a song + rarity card to the local collection */
  addToCollection: (song: MaplogSong, rarity: MaplogRarityType) => void;

  /** Remove a song entirely from the collection */
  removeFromCollection: (songId: string) => void;

  /**
   * Sync one rarity tier against a playlist's track list:
   * - songs in the playlist without a card of that rarity gain one
   * - songs with that rarity card that left the playlist lose it
   *   (and are dropped entirely when no cards remain)
   * Returns counts of what changed. No-op in demo mode.
   */
  syncRarity: (rarity: MaplogRarityType, playlistSongs: MaplogSong[]) => { added: number; removed: number };

  /** Reload collection from localStorage */
  refresh: () => void;

  /** Prompt the user to connect their Apple Music account */
  authorize: () => void;

  isDemoMode:    boolean;
  enterDemoMode: () => void;
  exitDemoMode:  () => void;
}

const MusicKitContext = createContext<MusicKitContextType | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────────

export function MusicKitProvider({ children }: { children: React.ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState<boolean>(
    () => localStorage.getItem(DEMO_MODE_KEY) === 'true',
  );
  const [songs, setSongs] = useState<MaplogSong[]>(
    () => localStorage.getItem(DEMO_MODE_KEY) === 'true' ? DEMO_SONGS : loadCollection(),
  );

  // ── MusicKit setup (developer token + user authorization) ─────────────────

  const [hasToken, setHasToken]         = useState(false);
  const [isReady, setIsReady]           = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [mkError, setMkError]           = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    initMusicKit()
      .then((mk) => {
        if (cancelled) return;
        setHasToken(true);
        setIsReady(true);
        setIsAuthorized(!!mk.isAuthorized);
        const onAuthChange = () => setIsAuthorized(!!mk.isAuthorized);
        mk.addEventListener('authorizationStatusDidChange', onAuthChange);
        cleanup = () => mk.removeEventListener('authorizationStatusDidChange', onAuthChange);
        if (cancelled) cleanup();
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('[MusicKit] init failed — preview-only mode:', err);
        setMkError(err instanceof Error ? err.message : String(err));
      });
    return () => { cancelled = true; cleanup?.(); };
  }, []);

  const authorize = useCallback(() => {
    initMusicKit()
      .then((mk) => mk.authorize())
      .then(() => {
        const mk = (window as any).MusicKit?.getInstance();
        if (mk) setIsAuthorized(!!mk.isAuthorized);
      })
      .catch((err: unknown) => console.warn('[MusicKit] authorize failed:', err));
  }, []);

  // ── Collection mutations ──────────────────────────────────────────────────

  const addToCollection = useCallback((song: MaplogSong, rarity: MaplogRarityType) => {
    if (isDemoMode) return; // demo is read-only
    {
      const prev = songsRef.current;
      const existing = prev.find(s => s.id === song.id);
      let updated: MaplogSong[];

      if (existing) {
        // Add another card variant to an existing song
        const newCard: MaplogCard = {
          id:          `${song.id}::${rarity.slug}::${Date.now()}`,
          artworkUrl:  song.artworkUrl,
          rarityType:  rarity,
          variantLabel: null,
        };
        updated = prev.map(s =>
          s.id === song.id
            ? {
                ...s,
                cards: [...s.cards, newCard].sort((a, b) => b.rarityType.tier - a.rarityType.tier),
              }
            : s,
        );
      } else {
        // New song
        const newCard: MaplogCard = {
          id:          `${song.id}::${rarity.slug}`,
          artworkUrl:  song.artworkUrl,
          rarityType:  rarity,
          variantLabel: null,
        };
        updated = [...prev, { ...song, cards: [newCard] }]
          .sort((a, b) => a.title.localeCompare(b.title));
      }

      commitCollection(updated);
    }
  }, [isDemoMode]);

  // Ref mirror so mutations in the same tick (e.g. refresh-all looping over
  // rarities) each see the previous mutation's result instead of stale state.
  const songsRef = React.useRef(songs);
  useEffect(() => { songsRef.current = songs; }, [songs]);

  /**
   * All collection mutations read from and write to songsRef synchronously
   * (JS is single-threaded, so read→compute→write is atomic per call), then
   * publish via setSongs. This prevents lost updates when several mutations
   * run in the same tick (e.g. refresh-all syncing multiple rarities).
   */
  const commitCollection = useCallback((updated: MaplogSong[]) => {
    songsRef.current = updated;
    saveCollection(updated);
    setSongs(updated);
  }, []);

  const normKey = (s: { title: string; artist: string }) =>
    `${s.title.trim().toLowerCase()}|${s.artist.trim().toLowerCase()}`;

  const syncRarity = useCallback((rarity: MaplogRarityType, playlistSongs: MaplogSong[]) => {
    if (isDemoMode) return { added: 0, removed: 0 };

    const current = songsRef.current;

    // Match playlist tracks to collection entries by exact id, falling back
    // to normalized title+artist so legacy (Deezer-id) entries aren't
    // misclassified as "left the playlist" and duplicated under Apple ids.
    const byId = new Map(current.map(s => [s.id, s]));
    const byTitleArtist = new Map<string, MaplogSong>();
    for (const s of current) {
      const k = normKey(s);
      if (!byTitleArtist.has(k)) byTitleArtist.set(k, s);
    }

    // Playlist track → matched existing song (or null = new). Dedupe playlist
    // tracks that resolve to the same target.
    const presentIds = new Set<string>();
    const toAdd: { track: MaplogSong; existing: MaplogSong | null }[] = [];
    const claimedNew = new Set<string>();
    for (const track of playlistSongs) {
      const existing = byId.get(track.id) ?? byTitleArtist.get(normKey(track)) ?? null;
      if (existing) {
        if (presentIds.has(existing.id)) continue; // duplicate within playlist
        presentIds.add(existing.id);
        toAdd.push({ track, existing });
      } else {
        if (claimedNew.has(track.id)) continue;
        claimedNew.add(track.id);
        toAdd.push({ track, existing: null });
      }
    }

    let added = 0, removed = 0;

    // 1) Remove this rarity's cards from songs no longer in the playlist
    let updated: MaplogSong[] = current
      .map(s => {
        const hasRarity = s.cards.some(c => c.rarityType.slug === rarity.slug);
        if (!hasRarity || presentIds.has(s.id)) return s;
        removed++;
        return { ...s, cards: s.cards.filter(c => c.rarityType.slug !== rarity.slug) };
      })
      .filter(s => s.cards.length > 0);

    // 2) Add missing songs / cards for playlist tracks
    const bySongId = new Map(updated.map(s => [s.id, s]));
    for (const { track, existing } of toAdd) {
      if (existing) {
        const live = bySongId.get(existing.id);
        if (!live || live.cards.some(c => c.rarityType.slug === rarity.slug)) continue;
        bySongId.set(existing.id, {
          ...live,
          cards: [...live.cards, {
            id: `${live.id}::${rarity.slug}::${Date.now()}`,
            artworkUrl: track.artworkUrl || live.artworkUrl,
            rarityType: rarity,
            variantLabel: null,
          }].sort((a, b) => b.rarityType.tier - a.rarityType.tier),
        });
        added++;
      } else {
        bySongId.set(track.id, {
          ...track,
          cards: [{
            id: `${track.id}::${rarity.slug}`,
            artworkUrl: track.artworkUrl,
            rarityType: rarity,
            variantLabel: null,
          }],
        });
        added++;
      }
    }

    updated = [...bySongId.values()].sort((a, b) => a.title.localeCompare(b.title));
    commitCollection(updated);
    return { added, removed };
  }, [isDemoMode, commitCollection]);

  const removeFromCollection = useCallback((songId: string) => {
    if (isDemoMode) return;
    commitCollection(songsRef.current.filter(s => s.id !== songId));
  }, [isDemoMode, commitCollection]);

  const refresh = useCallback(() => {
    if (isDemoMode) { setSongs([...DEMO_SONGS]); return; }
    setSongs(loadCollection());
  }, [isDemoMode]);

  // ── Demo mode ─────────────────────────────────────────────────────────────

  const enterDemoMode = useCallback(() => {
    localStorage.setItem(DEMO_MODE_KEY, 'true');
    setIsDemoMode(true);
    setSongs(DEMO_SONGS);
  }, []);

  const exitDemoMode = useCallback(() => {
    localStorage.removeItem(DEMO_MODE_KEY);
    setIsDemoMode(false);
    setSongs(loadCollection());
  }, []);

  // ── Lookup ────────────────────────────────────────────────────────────────

  const getSong = useCallback(
    (id: string) => songs.find(s => s.id === id),
    [songs],
  );

  return (
    <MusicKitContext.Provider
      value={{
        hasToken,
        isReady,
        isAuthorized,
        isLoading:           false,
        error:               mkError,
        songs,
        getSong,
        searchDeezer:        appleSearch,
        addToCollection,
        removeFromCollection,
        syncRarity,
        refresh,
        authorize,
        isDemoMode,
        enterDemoMode,
        exitDemoMode,
      }}
    >
      {children}
    </MusicKitContext.Provider>
  );
}

export function useMusicKit() {
  const ctx = useContext(MusicKitContext);
  if (!ctx) throw new Error('useMusicKit must be used within MusicKitProvider');
  return ctx;
}
