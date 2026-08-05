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
    setSongs(prev => {
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

      saveCollection(updated);
      return updated;
    });
  }, [isDemoMode]);

  const removeFromCollection = useCallback((songId: string) => {
    if (isDemoMode) return;
    setSongs(prev => {
      const updated = prev.filter(s => s.id !== songId);
      saveCollection(updated);
      return updated;
    });
  }, [isDemoMode]);

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
