/**
 * MusicKitContext — Deezer implementation.
 * Exports the same `MusicKitProvider` / `useMusicKit` names so all consumers
 * (Collection, SongDetail, App) require zero changes.
 */

import React, {
  createContext, useContext, useEffect, useState, useCallback, useRef,
} from 'react';
import type { MaplogSong, MaplogCard } from '@/lib/types';
import { isMaplogPlaylist, rarityFromPlaylistName } from '@/lib/rarityMap';
import { DEMO_SONGS } from '@/lib/demoData';

// ── Constants ─────────────────────────────────────────────────────────────────

const APP_ID_KEY    = 'maplog:deezerAppId';
const DEMO_MODE_KEY = 'maplog:demoMode';

// ── Deezer API helpers ────────────────────────────────────────────────────────

/** Promisified DZ.api() */
function dzApi(path: string): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof DZ === 'undefined') {
      reject(new Error('Deezer SDK not loaded. Check your internet connection.'));
      return;
    }
    DZ.api(path, (response: any) => {
      if (response?.error) {
        reject(new Error(response.error.message ?? `Deezer API error on ${path}`));
      } else {
        resolve(response);
      }
    });
  });
}

/** Fetch all pages of a Deezer paginated endpoint */
async function dzApiAll(startPath: string): Promise<any[]> {
  const items: any[] = [];
  let path: string | null = startPath;

  while (path) {
    const res = await dzApi(path);
    items.push(...(res.data ?? []));
    if (res.next) {
      try {
        const url = new URL(res.next);
        path = url.pathname + url.search;
      } catch {
        path = null;
      }
    } else {
      path = null;
    }
  }

  return items;
}

/** Load all songs from "Maplog · *" playlists */
async function loadMaplogSongs(): Promise<MaplogSong[]> {
  const playlists = await dzApiAll('/user/me/playlists?limit=100');

  const maplogPlaylists = playlists.filter((p: any) =>
    isMaplogPlaylist(p.title ?? ''),
  );

  if (maplogPlaylists.length === 0) return [];

  const songMap = new Map<string, MaplogSong>();

  await Promise.all(
    maplogPlaylists.map(async (playlist: any) => {
      const rarity = rarityFromPlaylistName(playlist.title);
      if (!rarity) return;

      const tracks = await dzApiAll(`/playlist/${playlist.id}/tracks?limit=100`);

      for (const track of tracks) {
        const songId = String(track.id);
        const artworkUrl: string =
          track.album?.cover_xl ?? track.album?.cover_big ?? track.album?.cover ?? '';

        const card: MaplogCard = {
          id: `${songId}::${rarity.slug}`,
          artworkUrl: artworkUrl || null,
          rarityType: rarity,
          variantLabel: null,
        };

        const existing = songMap.get(songId);
        if (existing) {
          existing.cards.push(card);
        } else {
          songMap.set(songId, {
            id: songId,
            title: track.title ?? 'Unknown',
            artist: track.artist?.name ?? 'Unknown Artist',
            album: track.album?.title ?? '',
            genre: null,
            durationMs: (track.duration ?? 0) * 1000,
            artworkUrl,
            previewUrl: track.preview ?? null,
            cards: [card],
          });
        }
      }
    }),
  );

  for (const song of songMap.values()) {
    song.cards.sort((a, b) => b.rarityType.tier - a.rarityType.tier);
  }

  return Array.from(songMap.values()).sort((a, b) =>
    a.title.localeCompare(b.title),
  );
}

// ── Context types ─────────────────────────────────────────────────────────────

interface MusicKitContextType {
  /** True when an App ID is saved OR demo mode is active */
  hasToken: boolean;
  /** SDK initialised and ready */
  isReady: boolean;
  /** User has authorised Deezer access */
  isAuthorized: boolean;
  /** Playlists are being loaded */
  isLoading: boolean;
  /** Error message, if any */
  error: string | null;
  /** Songs loaded from Deezer playlists */
  songs: MaplogSong[];
  /** Look up a single song by its Deezer track ID */
  getSong: (id: string) => MaplogSong | undefined;
  /** Open Deezer OAuth login popup */
  authorize: () => void;
  /** Reload songs from playlists */
  refresh: () => Promise<void>;
  /** Save a Deezer App ID and initialise the SDK */
  setAppId: (id: string) => void;
  /** The stored Deezer App ID */
  appId: string;
  /** True when running with mock data (no real Deezer account) */
  isDemoMode: boolean;
  enterDemoMode: () => void;
  exitDemoMode: () => void;
}

const MusicKitContext = createContext<MusicKitContextType | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function MusicKitProvider({ children }: { children: React.ReactNode }) {
  const [appId, setAppIdState] = useState<string>(
    () => import.meta.env.VITE_DEEZER_APP_ID || localStorage.getItem(APP_ID_KEY) || '',
  );
  const [isDemoMode, setIsDemoMode] = useState<boolean>(
    () => localStorage.getItem(DEMO_MODE_KEY) === 'true',
  );
  const [isReady, setIsReady]           = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading]       = useState(false);
  const [songs, setSongs]               = useState<MaplogSong[]>([]);
  const [error, setError]               = useState<string | null>(null);
  const sdkInitialized                  = useRef(false);

  // ── Demo mode shortcut ───────────────────────────────────────────────────
  useEffect(() => {
    if (isDemoMode) {
      setSongs(DEMO_SONGS);
      setIsReady(true);
      setIsAuthorized(true);
      setIsLoading(false);
      setError(null);
    }
  }, [isDemoMode]);

  // ── SDK init (real mode) ─────────────────────────────────────────────────
  useEffect(() => {
    if (!appId || isDemoMode || sdkInitialized.current) return;

    if (typeof DZ === 'undefined') {
      setError('Deezer SDK failed to load. Refresh the page.');
      return;
    }

    const base = import.meta.env.BASE_URL ?? '/';
    const channelUrl = `${window.location.origin}${base}channel.html`;

    DZ.init({
      appId,
      channelUrl,
    });
    sdkInitialized.current = true;
    setIsReady(true);

    // Check if already logged in from a previous session
    DZ.getLoginStatus((res) => {
      if (res.status === 'connected') {
        setIsAuthorized(true);
      }
    });
  }, [appId, isDemoMode]);

  // ── Load songs when authorised (real mode) ───────────────────────────────
  useEffect(() => {
    if (isDemoMode || !isReady || !isAuthorized) return;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const loaded = await loadMaplogSongs();
        setSongs(loaded);
      } catch (e: any) {
        console.error('Playlist load failed:', e);
        setError('Could not load playlists: ' + (e?.message ?? String(e)));
      } finally {
        setIsLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthorized]);

  // ── Public methods ───────────────────────────────────────────────────────

  const authorize = useCallback(() => {
    if (isDemoMode || typeof DZ === 'undefined') return;
    DZ.login(
      (res) => {
        if (res.status === 'connected') {
          setIsAuthorized(true);
          setError(null);
        } else {
          setError('Deezer login was cancelled or failed. Please try again.');
        }
      },
      { perms: 'basic_access,email,manage_library,listening_history,offline_access' },
    );
  }, [isDemoMode]);

  const refresh = useCallback(async () => {
    if (isDemoMode) { setSongs([...DEMO_SONGS]); return; }
    if (!isAuthorized) return;
    setIsLoading(true);
    setError(null);
    try {
      const loaded = await loadMaplogSongs();
      setSongs(loaded);
    } catch (e: any) {
      setError('Refresh failed: ' + (e?.message ?? String(e)));
    } finally {
      setIsLoading(false);
    }
  }, [isDemoMode, isAuthorized]);

  const setAppId = useCallback((id: string) => {
    const clean = id.trim();
    localStorage.setItem(APP_ID_KEY, clean);
    localStorage.removeItem(DEMO_MODE_KEY);
    sdkInitialized.current = false;
    setIsDemoMode(false);
    setAppIdState(clean);
    setIsReady(false);
    setIsAuthorized(false);
    setSongs([]);
    setError(null);
  }, []);

  const enterDemoMode = useCallback(() => {
    localStorage.setItem(DEMO_MODE_KEY, 'true');
    setIsDemoMode(true);
  }, []);

  const exitDemoMode = useCallback(() => {
    localStorage.removeItem(DEMO_MODE_KEY);
    setIsDemoMode(false);
    setSongs([]);
    setIsReady(false);
    setIsAuthorized(false);
  }, []);

  const getSong = useCallback(
    (id: string) => songs.find(s => s.id === id),
    [songs],
  );

  return (
    <MusicKitContext.Provider
      value={{
        hasToken: !!appId || isDemoMode,
        isReady,
        isAuthorized,
        isLoading,
        error,
        songs,
        getSong,
        authorize,
        refresh,
        setAppId,
        appId,
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
