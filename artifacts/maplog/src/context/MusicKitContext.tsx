import React, {
  createContext, useContext, useEffect, useState, useCallback, useRef,
} from 'react';
import type { MaplogSong, MaplogCard } from '@/lib/types';
import { isMaplogPlaylist, rarityFromPlaylistName } from '@/lib/rarityMap';
import { DEMO_SONGS } from '@/lib/demoData';

// ── Constants ────────────────────────────────────────────────────────────────

const TOKEN_STORAGE_KEY = 'maplog:developerToken';
const DEMO_MODE_KEY     = 'maplog:demoMode';

function resolveArtwork(url: string, size = 500): string {
  return url.replace('{w}', String(size)).replace('{h}', String(size));
}

// ── Apple Music REST API helper ───────────────────────────────────────────────

async function appleRequest(
  path: string,
  developerToken: string,
  userToken: string,
): Promise<any> {
  const base = path.startsWith('http') ? path : `https://api.music.apple.com${path}`;
  const res = await fetch(base, {
    headers: {
      Authorization: `Bearer ${developerToken}`,
      'Music-User-Token': userToken,
    },
  });
  if (!res.ok) throw new Error(`Apple Music API ${res.status} — ${path}`);
  return res.json();
}

// ── Playlist → songs loader ───────────────────────────────────────────────────

async function loadMaplogSongs(
  developerToken: string,
  userToken: string,
): Promise<MaplogSong[]> {
  const playlistsJson = await appleRequest(
    '/v1/me/library/playlists?limit=100',
    developerToken,
    userToken,
  );
  const allPlaylists: any[] = playlistsJson.data ?? [];
  const maplogPlaylists = allPlaylists.filter(
    p => isMaplogPlaylist(p.attributes?.name ?? ''),
  );
  if (maplogPlaylists.length === 0) return [];

  const songMap = new Map<string, MaplogSong>();

  await Promise.all(
    maplogPlaylists.map(async playlist => {
      const rarity = rarityFromPlaylistName(playlist.attributes.name);
      if (!rarity) return;

      let url: string | null =
        `/v1/me/library/playlists/${playlist.id}/tracks?limit=300`;

      while (url) {
        const tracksJson = await appleRequest(url, developerToken, userToken);
        const tracks: any[] = tracksJson.data ?? [];
        const nextUrl: string | null = tracksJson.next ?? null;

        for (const track of tracks) {
          const attrs = track.attributes ?? {};
          const songId: string = track.id;
          const artworkUrl = attrs.artwork?.url
            ? resolveArtwork(attrs.artwork.url, 500)
            : '';

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
              title: attrs.name ?? 'Unknown',
              artist: attrs.artistName ?? 'Unknown Artist',
              album: attrs.albumName ?? '',
              genre: attrs.genreNames?.[0],
              durationMs: attrs.durationInMillis ?? 0,
              artworkUrl,
              cards: [card],
            });
          }
        }
        url = nextUrl;
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
  hasToken: boolean;
  isReady: boolean;
  isAuthorized: boolean;
  isLoading: boolean;
  error: string | null;
  songs: MaplogSong[];
  getSong: (id: string) => MaplogSong | undefined;
  authorize: () => Promise<void>;
  refresh: () => Promise<void>;
  setDeveloperToken: (token: string) => void;
  developerToken: string;
  /** True when running with mock data instead of a real Apple Music account */
  isDemoMode: boolean;
  /** Activate demo mode (no token needed) */
  enterDemoMode: () => void;
  /** Clear demo mode (returns to Setup screen) */
  exitDemoMode: () => void;
}

const MusicKitContext = createContext<MusicKitContextType | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function MusicKitProvider({ children }: { children: React.ReactNode }) {
  const [developerToken, setTokenState] = useState<string>(
    () => import.meta.env.VITE_MUSICKIT_TOKEN || localStorage.getItem(TOKEN_STORAGE_KEY) || '',
  );
  const [isDemoMode, setIsDemoMode] = useState<boolean>(
    () => localStorage.getItem(DEMO_MODE_KEY) === 'true',
  );
  const [isReady, setIsReady] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [songs, setSongs] = useState<MaplogSong[]>([]);
  const [error, setError] = useState<string | null>(null);
  const loadedForToken = useRef<string>('');

  // ── Demo mode shortcut ───────────────────────────────────────────────────
  useEffect(() => {
    if (isDemoMode) {
      setSongs(DEMO_SONGS);
      setIsReady(true);
      setIsAuthorized(true);
      setIsLoading(false);
    }
  }, [isDemoMode]);

  // ── SDK initialisation (real mode only) ──────────────────────────────────
  useEffect(() => {
    if (!developerToken || isDemoMode) return;

    const init = async () => {
      try {
        await waitForMusicKit();
        await window.MusicKit.configure({
          developerToken,
          app: { name: 'Maplog', build: '1.0.0' },
        });
        const music = window.MusicKit.getInstance();
        setIsReady(true);
        setIsAuthorized(music.isAuthorized);
      } catch (e: any) {
        console.error('MusicKit init failed:', e);
        setError('Failed to initialise MusicKit: ' + (e?.message ?? String(e)));
      }
    };

    init();
  }, [developerToken, isDemoMode]);

  // ── Load songs when authorised (real mode only) ──────────────────────────
  useEffect(() => {
    if (isDemoMode || !isReady || !isAuthorized || !developerToken) return;
    if (loadedForToken.current === developerToken) return;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const music = window.MusicKit.getInstance();
        const loaded = await loadMaplogSongs(developerToken, music.musicUserToken);
        setSongs(loaded);
        loadedForToken.current = developerToken;
      } catch (e: any) {
        console.error('Playlist load failed:', e);
        setError('Could not load playlists: ' + (e?.message ?? String(e)));
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [isReady, isAuthorized, developerToken, isDemoMode]);

  // ── Public methods ───────────────────────────────────────────────────────

  const authorize = useCallback(async () => {
    if (isDemoMode) return;
    const music = window.MusicKit?.getInstance();
    if (!music) return;
    try {
      await music.authorize();
      setIsAuthorized(music.isAuthorized);
    } catch (e: any) {
      console.error('Authorization failed:', e);
      setError('Authorization failed: ' + (e?.message ?? String(e)));
    }
  }, [isDemoMode]);

  const refresh = useCallback(async () => {
    if (isDemoMode) { setSongs([...DEMO_SONGS]); return; }
    loadedForToken.current = '';
    const music = window.MusicKit?.getInstance();
    if (!music?.isAuthorized || !developerToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const loaded = await loadMaplogSongs(developerToken, music.musicUserToken);
      setSongs(loaded);
      loadedForToken.current = developerToken;
    } catch (e: any) {
      setError('Refresh failed: ' + (e?.message ?? String(e)));
    } finally {
      setIsLoading(false);
    }
  }, [developerToken, isDemoMode]);

  const setDeveloperToken = useCallback((token: string) => {
    const clean = token.trim();
    localStorage.setItem(TOKEN_STORAGE_KEY, clean);
    // Leaving demo mode if they paste a real token
    localStorage.removeItem(DEMO_MODE_KEY);
    setIsDemoMode(false);
    setTokenState(clean);
    setIsReady(false);
    setIsAuthorized(false);
    setSongs([]);
    loadedForToken.current = '';
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
        hasToken: !!developerToken || isDemoMode,
        isReady,
        isAuthorized,
        isLoading,
        error,
        songs,
        getSong,
        authorize,
        refresh,
        setDeveloperToken,
        developerToken,
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

// ── Utility: wait for MusicKit CDN script to load ─────────────────────────────

function waitForMusicKit(timeout = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.MusicKit) { resolve(); return; }
    const deadline = Date.now() + timeout;
    const check = setInterval(() => {
      if (window.MusicKit) { clearInterval(check); resolve(); return; }
      if (Date.now() > deadline) {
        clearInterval(check);
        reject(new Error('MusicKit JS did not load within 10 s. Check your internet connection.'));
      }
    }, 100);
  });
}
