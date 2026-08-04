/**
 * MusicKitContext — self-contained collection backed by localStorage.
 * Track search uses Deezer's public API (no auth required) via the API proxy.
 * Keeps the same MusicKitProvider / useMusicKit exports so all consumers need zero changes.
 */

import React, {
  createContext, useContext, useState, useCallback,
} from 'react';
import type { MaplogSong, MaplogCard, MaplogRarityType } from '@/lib/types';
import { DEMO_SONGS } from '@/lib/demoData';

// ── Constants ──────────────────────────────────────────────────────────────────

const COLLECTION_KEY = 'maplog:collection';
const DEMO_MODE_KEY  = 'maplog:demoMode';

// ── Deezer public search (via API proxy) ───────────────────────────────────────

function deezerTrackToSong(track: any): MaplogSong {
  return {
    id:         String(track.id),
    title:      track.title      ?? 'Unknown',
    artist:     track.artist?.name ?? 'Unknown Artist',
    album:      track.album?.title ?? '',
    genre:      null,
    durationMs: (track.duration ?? 0) * 1000,
    artworkUrl: track.album?.cover_xl ?? track.album?.cover_big ?? track.album?.cover ?? '',
    previewUrl: track.preview ?? null,
    cards:      [],
  };
}

async function deezerSearch(query: string): Promise<MaplogSong[]> {
  if (!query.trim()) return [];
  const res = await fetch(`/api/deezer/search?q=${encodeURIComponent(query)}&limit=25`);
  if (!res.ok) throw new Error('Search failed — please try again.');
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? 'Deezer search error');
  return (data.data ?? []).map(deezerTrackToSong);
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
  /** Always true — no setup required */
  hasToken:     boolean;
  isReady:      boolean;
  isAuthorized: boolean;
  isLoading:    boolean;
  error:        string | null;
  songs:        MaplogSong[];
  getSong:      (id: string) => MaplogSong | undefined;

  /** Search Deezer (no auth needed) */
  searchDeezer: (query: string) => Promise<MaplogSong[]>;

  /** Add a song + rarity card to the local collection */
  addToCollection: (song: MaplogSong, rarity: MaplogRarityType) => void;

  /** Remove a song entirely from the collection */
  removeFromCollection: (songId: string) => void;

  /** Reload collection from localStorage */
  refresh: () => void;

  /** No-op — kept for interface compatibility */
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
        hasToken:            true,
        isReady:             true,
        isAuthorized:        true,
        isLoading:           false,
        error:               null,
        songs,
        getSong,
        searchDeezer:        deezerSearch,
        addToCollection,
        removeFromCollection,
        refresh,
        authorize:           () => {},
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
