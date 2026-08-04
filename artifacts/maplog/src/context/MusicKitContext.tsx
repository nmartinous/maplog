import React, {
  createContext, useContext, useEffect, useState, useCallback, useRef,
} from 'react';
import type { MaplogSong, MaplogCard } from '@/lib/types';
import { isMaplogPlaylist, rarityFromPlaylistName } from '@/lib/rarityMap';

// ── Constants ────────────────────────────────────────────────────────────────

const TOKEN_STORAGE_KEY = 'maplog:developerToken';

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
  if (!res.ok) {
    throw new Error(`Apple Music API ${res.status} — ${path}`);
  }
  return res.json();
}

// ── Playlist → songs loader ───────────────────────────────────────────────────

async function loadMaplogSongs(
  developerToken: string,
  userToken: string,
): Promise<MaplogSong[]> {
  // 1. All library playlists (up to 100)
  const playlistsJson = await appleRequest(
    '/v1/me/library/playlists?limit=100',
    developerToken,
    userToken,
  );
  const allPlaylists: any[] = playlistsJson.data ?? [];

  // 2. Filter to "Maplog · *" playlists
  const maplogPlaylists = allPlaylists.filter(
    p => isMaplogPlaylist(p.attributes?.name ?? ''),
  );

  if (maplogPlaylists.length === 0) return [];

  // 3. Fetch tracks for each playlist, merge into a song map
  const songMap = new Map<string, MaplogSong>();

  await Promise.all(
    maplogPlaylists.map(async playlist => {
      const rarity = rarityFromPlaylistName(playlist.attributes.name);
      if (!rarity) return;

      let url: string | null =
        `/v1/me/library/playlists/${playlist.id}/tracks?limit=300`;

      // Handle paginated responses
      while (url) {
        const tracksJson = await appleRequest(url, developerToken, userToken);
        const tracks: any[] = tracksJson.data ?? [];
        const nextUrl: string | null = tracksJson.next ?? null;

        for (const track of tracks) {
          const attrs = track.attributes ?? {};
          const songId: string = track.id; // e.g. "i.XXXXXXXX"
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

  // 4. Sort each song's cards by tier descending (best rarity first)
  for (const song of songMap.values()) {
    song.cards.sort((a, b) => b.rarityType.tier - a.rarityType.tier);
  }

  // 5. Sort songs alphabetically by title
  return Array.from(songMap.values()).sort((a, b) =>
    a.title.localeCompare(b.title),
  );
}

// ── Context types ─────────────────────────────────────────────────────────────

interface MusicKitContextType {
  /** Developer token is stored in localStorage */
  hasToken: boolean;
  /** MusicKit SDK configured and ready */
  isReady: boolean;
  /** User has authorised Apple Music access */
  isAuthorized: boolean;
  /** Playlists are being loaded */
  isLoading: boolean;
  /** Error string if anything went wrong */
  error: string | null;
  /** All Maplog songs loaded from Apple Music playlists */
  songs: MaplogSong[];
  /** Look up a single song by its MusicKit ID */
  getSong: (id: string) => MaplogSong | undefined;
  /** Open Apple's authorization popup */
  authorize: () => Promise<void>;
  /** Reload songs from playlists */
  refresh: () => Promise<void>;
  /** Save a developer token and reload the SDK */
  setDeveloperToken: (token: string) => void;
  /** The stored developer token (empty string if none) */
  developerToken: string;
}

const MusicKitContext = createContext<MusicKitContextType | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function MusicKitProvider({ children }: { children: React.ReactNode }) {
  const [developerToken, setTokenState] = useState<string>(
    () => import.meta.env.VITE_MUSICKIT_TOKEN || localStorage.getItem(TOKEN_STORAGE_KEY) || '',
  );
  const [isReady, setIsReady] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [songs, setSongs] = useState<MaplogSong[]>([]);
  const [error, setError] = useState<string | null>(null);
  const loadedForToken = useRef<string>('');

  // ── SDK initialisation ───────────────────────────────────────────────────
  useEffect(() => {
    if (!developerToken) return;

    const init = async () => {
      try {
        // MusicKit loads asynchronously from CDN; wait for it
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
  }, [developerToken]);

  // ── Load songs when authorised ───────────────────────────────────────────
  useEffect(() => {
    if (!isReady || !isAuthorized || !developerToken) return;
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
  }, [isReady, isAuthorized, developerToken]);

  // ── Public methods ───────────────────────────────────────────────────────

  const authorize = useCallback(async () => {
    const music = window.MusicKit?.getInstance();
    if (!music) return;
    try {
      await music.authorize();
      setIsAuthorized(music.isAuthorized);
    } catch (e: any) {
      console.error('Authorization failed:', e);
      setError('Authorization failed: ' + (e?.message ?? String(e)));
    }
  }, []);

  const refresh = useCallback(async () => {
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
  }, [developerToken]);

  const setDeveloperToken = useCallback((token: string) => {
    const clean = token.trim();
    localStorage.setItem(TOKEN_STORAGE_KEY, clean);
    setTokenState(clean);
    setIsReady(false);
    setIsAuthorized(false);
    setSongs([]);
    loadedForToken.current = '';
  }, []);

  const getSong = useCallback(
    (id: string) => songs.find(s => s.id === id),
    [songs],
  );

  return (
    <MusicKitContext.Provider
      value={{
        hasToken: !!developerToken,
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
