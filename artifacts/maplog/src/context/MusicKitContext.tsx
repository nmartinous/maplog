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
import { initMusicKit } from '@/lib/musicKit';
import { ensureCardTags, normalizeTags, sameTagPool, tagsFromRaritySlug, validateTrackCards } from '@/lib/tags';
import {
  loadConflicts, saveConflicts, makeConflictId, conflictFingerprint, type TagConflict,
} from '@/lib/conflicts';
import { gcOrphanedMedia } from '@/lib/mediaStore';
import { MOMENT_RARITY } from '@/lib/cardTemplates';

// ── Constants ──────────────────────────────────────────────────────────────────

const COLLECTION_KEY = 'maplog:collection';

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

/** Migrate legacy entries: every card gains a tag pool derived from its rarity. */
function migrateTags(songs: MaplogSong[]): { songs: MaplogSong[]; changed: boolean } {
  let changed = false;
  const migrated = songs.map(s => {
    let cardsChanged = false;
    const cards = s.cards.map(c => {
      const next = ensureCardTags(c);
      if (next !== c) cardsChanged = true;
      return next;
    });
    if (!cardsChanged) return s;
    changed = true;
    return { ...s, cards };
  });
  return { songs: migrated, changed };
}

function loadCollection(): MaplogSong[] {
  try {
    const raw = localStorage.getItem(COLLECTION_KEY);
    const parsed: MaplogSong[] = raw ? JSON.parse(raw) : [];
    const { songs, changed } = migrateTags(parsed);
    if (changed) saveCollection(songs); // persist migration once
    return songs;
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

  /** Remove a song entirely from the collection (also GCs its media). */
  removeSong: (songId: string) => void;

  /**
   * Sync one rarity tier against a playlist's track list:
   * - songs in the playlist without a card of that rarity gain one
   * - songs with that rarity card that left the playlist lose it
   *   (and are dropped entirely when no cards remain)
   * Returns counts of what changed. No-op in demo mode.
   */
  syncRarity: (rarity: MaplogRarityType, playlistSongs: MaplogSong[]) => { added: number; removed: number; addedSongs: MaplogSong[] };

  /** Reload collection from localStorage */
  refresh: () => void;

  /** Edit a song's display info (Edit Mode). */
  updateSong: (songId: string, patch: Partial<Pick<MaplogSong, 'title' | 'artist' | 'album' | 'genre'>>) => void;
  /** Replace one card's tag pool (Edit Mode; caller validates). */
  updateCardTags: (songId: string, cardId: string, tags: string[]) => void;
  updateCardMeta: (songId: string, cardId: string, patch: Partial<Pick<MaplogCard, 'flavorText' | 'subjectText' | 'pin' | 'patternId' | 'variantLabel'>>) => void;

  /**
   * Create a standalone Moment entry (title + artist).
   * Returns the new synthetic songId and cardId so the caller can immediately
   * open the media upload for the video. Throws if a Moment with that title
   * already exists (case-insensitive).
   */
  addMoment: (title: string, artist: string) => { songId: string; cardId: string };

  /** Queued tag-rule conflicts awaiting resolution */
  conflicts: TagConflict[];
  /** Dedupe + validate the collection; pulls rule-breaking copies into the queue */
  runConflictScan: () => { newConflicts: TagConflict[]; deduped: number };
  /** Keep one copy (card id) or discard all (null) for a queued conflict */
  resolveConflict: (conflictId: string, keepCardId: string | null) => void;

  /** Prompt the user to connect their Apple Music account */
  authorize: () => void;
}

const MusicKitContext = createContext<MusicKitContextType | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────────

export function MusicKitProvider({ children }: { children: React.ReactNode }) {
  const [songs, setSongs] = useState<MaplogSong[]>(() => loadCollection());
  const [conflicts, setConflicts] = useState<TagConflict[]>(() => loadConflicts());

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
          tags:        normalizeTags(tagsFromRaritySlug(rarity.slug) ?? []),
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
          tags:        normalizeTags(tagsFromRaritySlug(rarity.slug) ?? []),
        };
        updated = [...prev, { ...song, cards: [newCard] }]
          .sort((a, b) => a.title.localeCompare(b.title));
      }

      commitCollection(updated);
    }
  }, []);

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

  /** Edit a song's display info (Edit Mode). */
  const updateSong = useCallback((songId: string, patch: Partial<Pick<MaplogSong, 'title' | 'artist' | 'album' | 'genre'>>) => {
    const updated = songsRef.current.map(s => s.id === songId ? { ...s, ...patch } : s);
    commitCollection(updated);
  }, [commitCollection]);

  /** Edit one card's display metadata (flavor/subject/pin/pattern/variantLabel). */
  const updateCardMeta = useCallback((songId: string, cardId: string, patch: Partial<Pick<MaplogCard, 'flavorText' | 'subjectText' | 'pin' | 'patternId' | 'variantLabel'>>) => {
    const updated = songsRef.current.map(s =>
      s.id === songId
        ? { ...s, cards: s.cards.map(c => c.id === cardId ? { ...c, ...patch } : c) }
        : s,
    );
    commitCollection(updated);
  }, [commitCollection]);

  /** Replace one card's tag pool (Edit Mode; caller validates). */
  const updateCardTags = useCallback((songId: string, cardId: string, tags: string[]) => {
    const pool = normalizeTags(tags);
    const updated = songsRef.current.map(s =>
      s.id === songId
        ? { ...s, cards: s.cards.map(c => c.id === cardId ? { ...c, tags: pool } : c) }
        : s,
    );
    commitCollection(updated);
  }, [commitCollection]);

  const normKey = (s: { title: string; artist: string }) =>
    `${s.title.trim().toLowerCase()}|${s.artist.trim().toLowerCase()}`;

  const syncRarity = useCallback((rarity: MaplogRarityType, playlistSongs: MaplogSong[]) => {
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
    const addedSongIds = new Set<string>(); // track which songs received a new card

    // 1) Remove this rarity's cards from songs no longer in the playlist
    let updated: MaplogSong[] = current
      .map(s => {
        const hasRarity = s.cards.some(c => c.rarityType.slug === rarity.slug);
        if (!hasRarity || presentIds.has(s.id)) return s;
        removed++;
        return { ...s, cards: s.cards.filter(c => c.rarityType.slug !== rarity.slug) };
      })
      .filter(s => s.cards.length > 0);

    // Helper: pick up trackNumber/discNumber/albumId from a fresh playlist track,
    // but only overwrite when the live song is missing the field (don't clobber
    // manually edited data, and don't null-out values we already have).
    const trackMeta = (track: MaplogSong, live: MaplogSong): Partial<MaplogSong> => {
      const patch: Partial<MaplogSong> = {};
      if (track.trackNumber != null && live.trackNumber == null) patch.trackNumber = track.trackNumber;
      if (track.discNumber  != null && live.discNumber  == null) patch.discNumber  = track.discNumber;
      if (track.albumId     != null && live.albumId     == null) patch.albumId     = track.albumId;
      return patch;
    };

    // 2) Add missing songs / cards for playlist tracks
    const bySongId = new Map(updated.map(s => [s.id, s]));
    for (const { track, existing } of toAdd) {
      if (existing) {
        const live = bySongId.get(existing.id);
        if (!live) continue;
        if (live.cards.some(c => c.rarityType.slug === rarity.slug)) {
          // Song already has this rarity — just patch track metadata if richer data arrived
          const meta = trackMeta(track, live);
          if (Object.keys(meta).length > 0) bySongId.set(existing.id, { ...live, ...meta });
          continue;
        }
        // Use a stable id (no timestamp) so re-added songs recover their
        // previously uploaded media from IndexedDB without any remap.
        bySongId.set(existing.id, {
          ...live,
          ...trackMeta(track, live),
          cards: [...live.cards, {
            id: `${live.id}::${rarity.slug}`,
            artworkUrl: track.artworkUrl || live.artworkUrl,
            rarityType: rarity,
            variantLabel: null,
            tags: normalizeTags(tagsFromRaritySlug(rarity.slug) ?? []),
          }].sort((a, b) => b.rarityType.tier - a.rarityType.tier),
        });
        addedSongIds.add(existing.id);
        added++;
      } else {
        bySongId.set(track.id, {
          ...track,
          cards: [{
            id: `${track.id}::${rarity.slug}`,
            artworkUrl: track.artworkUrl,
            rarityType: rarity,
            variantLabel: null,
            tags: normalizeTags(tagsFromRaritySlug(rarity.slug) ?? []),
          }],
        });
        addedSongIds.add(track.id);
        added++;
      }
    }

    updated = [...bySongId.values()].sort((a, b) => a.title.localeCompare(b.title));
    commitCollection(updated);

    // Fire-and-forget: clean up media entries whose cards no longer exist.
    // This collects timestamps from old sync runs and any other orphans.
    const activeCardIds = updated.flatMap(s => s.cards.map(c => c.id));
    gcOrphanedMedia(activeCardIds).catch(err =>
      console.warn('[mediaStore] gcOrphanedMedia failed:', err),
    );

    const addedSongs = updated.filter(s => addedSongIds.has(s.id));
    return { added, removed, addedSongs };
  }, [commitCollection]);

  /** Create a standalone Moment entry. Throws on duplicate title. */
  const addMoment = useCallback((title: string, artist: string): { songId: string; cardId: string } => {
    const norm = title.trim().toLowerCase();
    if (!norm) throw new Error('Moment title cannot be empty.');
    const duplicate = songsRef.current.some(s =>
      s.title.trim().toLowerCase() === norm &&
      s.cards.some(c => c.tags?.includes('moment') || c.rarityType.slug === 'moment'),
    );
    if (duplicate) throw new Error(`A Moment named "${title.trim()}" already exists.`);

    const songId = `moment::${Date.now()}::${Math.random().toString(36).slice(2, 7)}`;
    const cardId = `${songId}::moment`;
    const newSong: MaplogSong = {
      id: songId,
      title: title.trim(),
      artist: artist.trim(),
      album: '',
      durationMs: 0,
      artworkUrl: '',
      cards: [{
        id: cardId,
        artworkUrl: null,
        rarityType: MOMENT_RARITY,
        variantLabel: null,
        tags: ['moment'],
      }],
    };
    const updated = [...songsRef.current, newSong].sort((a, b) => a.title.localeCompare(b.title));
    commitCollection(updated);
    return { songId, cardId };
  }, [commitCollection]);

  /** Remove a song and GC its media from IndexedDB. */
  const removeSong = useCallback((songId: string) => {
    const updated = songsRef.current.filter(s => s.id !== songId);
    commitCollection(updated);
    const activeCardIds = updated.flatMap(s => s.cards.map(c => c.id));
    gcOrphanedMedia(activeCardIds).catch(err =>
      console.warn('[mediaStore] gcOrphanedMedia failed:', err),
    );
  }, [commitCollection]);

  const refresh = useCallback(() => {
    setSongs(loadCollection());
  }, []);

  // When the Drive sync pull writes new data to localStorage, reload both
  // the collection and conflicts so React state reflects what was pulled
  // before the user interacts (e.g. before hitting "Refresh All" playlists).
  useEffect(() => {
    const onPulled = () => {
      setSongs(loadCollection());
      setConflicts(loadConflicts());
    };
    window.addEventListener('harmony:sync:pulled', onPulled);
    return () => window.removeEventListener('harmony:sync:pulled', onPulled);
  }, []);

  // ── Tag conflicts ─────────────────────────────────────────────────────────

  const commitConflicts = useCallback((next: TagConflict[]) => {
    saveConflicts(next);
    setConflicts(next);
  }, []);

  /**
   * Validate the whole collection against the tag rules:
   * - exact tag-pool duplicates are silently deduped
   * - rule violations pull ALL involved copies out of the collection and
   *   queue them for conflict resolution
   * Returns the newly queued conflicts + dedupe count.
   */
  const runConflictScan = useCallback((): { newConflicts: TagConflict[]; deduped: number } => {
    const current = songsRef.current;
    const newConflicts: TagConflict[] = [];
    let deduped = 0;
    let changed = false;

    const updated: MaplogSong[] = [];
    for (const song of current) {
      const { validCards, deduped: d, conflictGroups } = validateTrackCards(song.cards);
      deduped += d;
      if (d > 0 || conflictGroups.length > 0 || validCards.length !== song.cards.length) changed = true;

      for (const group of conflictGroups) {
        const { cards: _cards, ...track } = song;
        newConflicts.push({
          id: makeConflictId(),
          trackId: song.id,
          title: song.title,
          artist: song.artist,
          artworkUrl: song.artworkUrl,
          reason: group.reason,
          copies: group.copies,
          track,
          createdAt: new Date().toISOString(),
        });
      }

      if (validCards.length > 0) {
        updated.push(validCards === song.cards ? song : { ...song, cards: validCards });
      }
    }

    if (changed) commitCollection(updated);
    if (newConflicts.length > 0) {
      // Upsert by fingerprint — re-refreshing without fixing the playlists
      // re-detects the same conflicts and must not duplicate queue entries.
      const queue = loadConflicts();
      const known = new Set(queue.map(conflictFingerprint));
      const fresh = newConflicts.filter(c => !known.has(conflictFingerprint(c)));
      if (fresh.length > 0) commitConflicts([...queue, ...fresh]);
      return { newConflicts: fresh, deduped };
    }
    return { newConflicts, deduped };
  }, [commitCollection, commitConflicts]);

  /**
   * Resolve one queued conflict: keep one copy (restores it into the
   * collection) or discard all copies (keepCardId = null).
   */
  const resolveConflict = useCallback((conflictId: string, keepCardId: string | null) => {
    const queue = loadConflicts();
    const conflict = queue.find(c => c.id === conflictId);
    if (!conflict) return;

    if (keepCardId) {
      const copy = conflict.copies.find(cp => cp.card.id === keepCardId);
      if (!copy) return;
      const prev = songsRef.current;
      const existing = prev.find(s => s.id === conflict.trackId);
      let updated: MaplogSong[];
      if (existing) {
        // Don't re-add if an equivalent card already exists (same id or
        // same normalized tag pool)
        const keptTags = normalizeTags(copy.card.tags ?? []);
        const dup = existing.cards.some(c =>
          c.id === copy.card.id ||
          (keptTags.length > 0 && sameTagPool(normalizeTags(c.tags ?? []), keptTags)));
        updated = dup ? prev : prev.map(s => s.id === conflict.trackId
          ? { ...s, cards: [...s.cards, copy.card].sort((a, b) => b.rarityType.tier - a.rarityType.tier) }
          : s);
      } else {
        updated = [...prev, { ...conflict.track, cards: [copy.card] } as MaplogSong]
          .sort((a, b) => a.title.localeCompare(b.title));
      }
      commitCollection(updated);
    }

    commitConflicts(queue.filter(c => c.id !== conflictId));
  }, [commitCollection, commitConflicts]);

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
        syncRarity,
        refresh,
        removeSong,
        updateSong,
        updateCardTags,
        updateCardMeta,
        addMoment,
        conflicts,
        runConflictScan,
        resolveConflict,
        authorize,
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
