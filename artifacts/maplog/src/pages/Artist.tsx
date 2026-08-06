import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArtMenu } from '@/components/ArtMenu';
import { useLocation, useRoute } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, Music2, Quote, StickyNote, Coins, ChevronRight, Camera,
  BadgeCheck, Sparkles, Disc3, ExternalLink, Check, ChevronDown, AlertCircle,
  ListMusic, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useMusicKit } from '@/context/MusicKitContext';
import { usePlayer } from '@/context/AudioPlayerContext';
import type { MaplogSong } from '@/lib/types';
import { badgesForArtist, BADGE_LABELS, BADGE_COLORS, artistKey } from '@/lib/badges';
import { vaultEntries, filterEntries } from '@/lib/vaultStats';
import { abbreviateValue, exactValue } from '@/lib/format';
import { fileToAvatar } from '@/lib/profile';
import {
  loadArtistData, saveArtistData, importArtistInfo, importedInfoIsFresh,
  type ArtistData,
} from '@/lib/artistData';
import { ShowcaseSection } from '@/components/ShowcaseSection';
import { SoundmapCard } from '@/components/SoundmapCard';
import { RarityBadge } from '@/components/RarityBadge';

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <Icon className="w-5 h-5 text-primary" />
      <h2 className="text-sm font-bold tracking-widest uppercase text-white/80">{title}</h2>
    </div>
  );
}

// ── Album track types ──────────────────────────────────────────────────────────
interface AlbumTrack {
  trackNumber: number;
  discNumber: number;
  catalogId: string;
  title: string;
  durationMs: number;
  artworkUrl: string | null;
}
interface AlbumData {
  albumId: string;
  name: string;
  artworkUrl: string | null;
  releaseDate: string | null;
  releaseType: 'album' | 'ep' | 'single';
  trackCount: number;
  tracks: AlbumTrack[];
}

// ── Release type badge ─────────────────────────────────────────────────────────
const RELEASE_TYPE_STYLES = {
  album:  'bg-violet-500/15 text-violet-300 border-violet-500/30',
  ep:     'bg-sky-500/15 text-sky-300 border-sky-500/30',
  single: 'bg-white/5 text-white/40 border-white/10',
};
const RELEASE_TYPE_LABELS = { album: 'Album', ep: 'EP', single: 'Single' };

function fmtDuration(ms: number) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ── Single album card ──────────────────────────────────────────────────────────
function AlbumCard({
  albumName, songs, navigate,
}: {
  albumName: string;
  songs: MaplogSong[];
  navigate: (to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [albumData, setAlbumData] = useState<AlbumData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const artistName = songs[0]?.artist ?? '';
  const artworkUrl = songs[0]?.artworkUrl ?? null;

  // True when every collected song has a stored trackNumber — we can show
  // correct album order immediately without a network round-trip.
  const hasStoredOrder = songs.every(s => s.trackNumber != null);

  // Collected songs sorted by disc + track number when available.
  const sortedSongs = useMemo(() => {
    if (!hasStoredOrder) return songs;
    return [...songs].sort(
      (a, b) => ((a.discNumber ?? 1) - (b.discNumber ?? 1)) || ((a.trackNumber ?? 0) - (b.trackNumber ?? 0)),
    );
  }, [songs, hasStoredOrder]);

  // Heuristic release type based on songs collected (shown before fetch)
  const heuristicType: 'album' | 'ep' | 'single' =
    albumData?.releaseType ??
    (songs.length === 1 ? 'single' : songs.length <= 6 ? 'ep' : 'album');

  const fetchTracks = async () => {
    if (albumData || loading) return;
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({ album: albumName, artist: artistName });
      const res = await fetch(`/api/apple-music/album-tracks?${params}`);
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? 'Failed to load tracks.');
      setAlbumData(json as AlbumData);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Could not load the full track listing.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(o => !o);
    // When songs already have stored track numbers, skip the live fetch — the
    // correct order is already known offline. Fall back to live fetch for older
    // entries that were imported before track metadata was stored.
    if (!albumData && !hasStoredOrder) fetchTracks();
  };

  // Map of catalogId → collected songs (multiple rarities possible)
  const collectedMap = useMemo(() => {
    const m = new Map<string, MaplogSong>();
    for (const s of songs) {
      const catalogId = s.id.replace('apple:', '');
      m.set(catalogId, s);
    }
    return m;
  }, [songs]);

  const tracks = albumData?.tracks ?? [];
  const type = albumData?.releaseType ?? heuristicType;

  return (
    <div className="rounded-2xl glass-panel overflow-hidden">
      {/* Header row */}
      <button
        className="w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-white/5 active:bg-white/[0.07] transition-colors"
        onClick={handleOpen}
        aria-expanded={open}
      >
        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-white/5">
          {artworkUrl
            ? <img src={artworkUrl} alt={albumName} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center"><Disc3 className="w-5 h-5 text-white/20" /></div>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{albumName}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn(
              'text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border',
              RELEASE_TYPE_STYLES[type],
            )}>{RELEASE_TYPE_LABELS[type]}</span>
            <span className="text-[11px] text-white/40">
              {songs.length} collected{albumData ? ` · ${albumData.trackCount} total` : ''}
            </span>
          </div>
        </div>
        <ChevronDown className={cn('w-4 h-4 text-white/40 shrink-0 transition-transform duration-300', open && 'rotate-180')} />
      </button>

      {/* Expanded track listing */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            className="border-t border-white/5 overflow-hidden"
          >
            <div className="px-4 py-3 space-y-1">
              {/* Spinner only when fetching live and no stored order to show */}
              {loading && !hasStoredOrder && (
                <div className="flex items-center justify-center py-6 gap-2 text-white/40">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs font-semibold">Loading tracks…</span>
                </div>
              )}
              {fetchError && !tracks.length && (
                <div className="flex items-center gap-2 py-4 text-amber-400/80">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p className="text-xs">{fetchError}</p>
                </div>
              )}
              {/* Full live track listing (includes non-collected tracks) */}
              {tracks.map(track => {
                const collected = collectedMap.get(track.catalogId);
                return (
                  <TrackRow
                    key={track.trackNumber}
                    track={track}
                    collected={collected}
                    navigate={navigate}
                  />
                );
              })}
              {/* Offline / pre-fetch fallback: stored track numbers give instant correct order */}
              {tracks.length === 0 && (
                sortedSongs.map((s, i) => (
                  <CollectedTrackRow
                    key={s.id}
                    song={s}
                    trackNumber={s.trackNumber ?? (i + 1)}
                    navigate={navigate}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TrackRow({ track, collected, navigate }: {
  track: AlbumTrack;
  collected: MaplogSong | undefined;
  navigate: (to: string) => void;
}) {
  const hasCards = collected && collected.cards.length > 0;

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-2 py-2 rounded-xl transition-colors',
        collected ? 'hover:bg-white/5 cursor-pointer active:bg-white/[0.07]' : 'opacity-35',
      )}
      onClick={collected ? () => navigate(`/song/${encodeURIComponent(collected.id)}`) : undefined}
    >
      <span className="text-[11px] font-mono text-white/30 w-5 text-right shrink-0">{track.trackNumber}</span>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-semibold truncate', collected ? 'text-white' : 'text-white/50')}>
          {track.title}
        </p>
        <p className="text-[10px] text-white/30">{fmtDuration(track.durationMs)}</p>
      </div>
      {hasCards && (
        <div className="flex gap-1 shrink-0 flex-wrap justify-end max-w-[120px]">
          {collected.cards.slice(0, 3).map(c => (
            <RarityBadge key={c.id} slug={c.rarityType.slug} name={c.rarityType.name} category={c.rarityType.category} size="sm" />
          ))}
          {collected.cards.length > 3 && (
            <span className="text-[10px] font-bold text-white/40">+{collected.cards.length - 3}</span>
          )}
        </div>
      )}
      {!collected && (
        <span className="text-[10px] text-white/20 font-semibold shrink-0">Missing</span>
      )}
    </div>
  );
}

function CollectedTrackRow({ song, trackNumber, navigate }: {
  song: MaplogSong;
  trackNumber: number;
  navigate: (to: string) => void;
}) {
  return (
    <div
      className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 cursor-pointer active:bg-white/[0.07] transition-colors"
      onClick={() => navigate(`/song/${encodeURIComponent(song.id)}`)}
    >
      <span className="text-[11px] font-mono text-white/30 w-5 text-right shrink-0">{trackNumber}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{song.title}</p>
      </div>
      <div className="flex gap-1 shrink-0">
        {song.cards.slice(0, 2).map(c => (
          <RarityBadge key={c.id} slug={c.rarityType.slug} name={c.rarityType.name} category={c.rarityType.category} size="sm" />
        ))}
      </div>
    </div>
  );
}

// ── Releases section ───────────────────────────────────────────────────────────
function ReleasesSection({ songs, navigate }: {
  songs: MaplogSong[];
  navigate: (to: string) => void;
}) {
  // Group songs by album name
  const albums = useMemo(() => {
    const map = new Map<string, MaplogSong[]>();
    for (const s of songs) {
      const key = s.album || '(No album)';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [songs]);

  if (albums.length === 0) return null;

  return (
    <section>
      <SectionHeader icon={ListMusic} title="Releases" />
      <div className="space-y-3">
        {albums.map(([albumName, albumSongs]) => (
          <AlbumCard
            key={albumName}
            albumName={albumName}
            songs={albumSongs}
            navigate={navigate}
          />
        ))}
      </div>
    </section>
  );
}

// ── Artist page component ──────────────────────────────────────────────────────
export default function Artist() {
  const { songs } = useMusicKit();
  const { play } = usePlayer();
  const [, navigate] = useLocation();
  const [, params] = useRoute('/artists/:name');
  const pinnedName = params?.name ? decodeURIComponent(params.name) : null;

  // Unique artists in collection
  const artists = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of songs) {
      const k = artistKey(s.artist);
      if (!map.has(k)) map.set(k, s.artist);
    }
    return [...map.values()].sort((a, b) => a.localeCompare(b));
  }, [songs]);

  const artist = pinnedName && artists.some(a => artistKey(a) === artistKey(pinnedName))
    ? artists.find(a => artistKey(a) === artistKey(pinnedName))!
    : null;

  // ── Search ────────────────────────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return artists.filter(a => a.toLowerCase().includes(q)).slice(0, 8);
  }, [query, artists]);

  // Artwork for the ambient bleed background
  const bleedArt = useMemo(() => {
    if (!artist) return null;
    return songs.filter(s => artistKey(s.artist) === artistKey(artist))[0]?.artworkUrl ?? null;
  }, [songs, artist]);

  if (!artist) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center bg-background">
        <Music2 className="h-14 w-14 text-white/10 mb-6" />
        <h2 className="text-xl font-display font-bold text-white mb-2">Artist not found</h2>
        <p className="text-white/50 text-sm max-w-xs leading-relaxed">
          {artists.length === 0
            ? 'Artists appear here once you add songs to your collection.'
            : `"${pinnedName}" isn't in your collection yet.`}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden scrollbar-hide bg-background pb-20 relative">
      {/* Art bleed — top hero area, scrolls away naturally */}
      <AnimatePresence>
        {bleedArt && (
          <motion.div
            key={bleedArt}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.85 }}
            className="absolute top-0 left-0 right-0 h-[50vh] z-0 pointer-events-none overflow-hidden"
          >
            <img
              src={bleedArt}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover blur-[80px] scale-150 transform-gpu opacity-40"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/60 to-background" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="page-top px-4 sm:px-6 relative z-10">
        {/* Search bar */}
        <div className="relative mb-6 z-30">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search another artist…"
              className="w-full h-11 rounded-2xl bg-white/5 border border-white/10 pl-11 pr-10 text-sm font-semibold text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {query && (
              <button className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40" onClick={() => setQuery('')} aria-label="Clear search">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <AnimatePresence>
            {matches.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                className="absolute left-0 right-0 top-full mt-2 rounded-2xl bg-[#141417] border border-white/10 shadow-2xl overflow-hidden"
              >
                {matches.map(a => (
                  <button key={a}
                    className="w-full text-left px-4 py-3 text-sm font-bold text-white/80 hover:bg-white/5"
                    onClick={() => { setQuery(''); navigate(`/artists/${encodeURIComponent(a)}`); }}
                  >
                    {a}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={artist}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
          >
            <ArtistPage artist={artist} songs={songs} play={play} navigate={navigate} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── ArtistPage ─────────────────────────────────────────────────────────────────
function ArtistPage({ artist, songs, play, navigate }: {
  artist: string;
  songs: MaplogSong[];
  play: (song: MaplogSong, queue: MaplogSong[]) => void;
  navigate: (to: string) => void;
}) {
  const artistSongs = useMemo(
    () => songs.filter(s => artistKey(s.artist) === artistKey(artist)),
    [songs, artist],
  );

  const [data, setData] = useState<ArtistData>(() => loadArtistData(artist));
  useEffect(() => { setData(loadArtistData(artist)); }, [artist]);

  const commit = (patch: Partial<ArtistData>) => {
    if (saveArtistData(artist, patch)) {
      setData(d => ({ ...d, ...patch }));
    } else {
      toast.error("Couldn't save — storage is full.");
    }
  };

  useEffect(() => {
    const current = loadArtistData(artist);
    if (importedInfoIsFresh(current)) return;
    let cancelled = false;
    importArtistInfo(artist).then(info => {
      if (!cancelled && info) setData(d => ({ ...d, imported: info }));
    });
    return () => { cancelled = true; };
  }, [artist]);

  const imageUrl = data.imageUrl ?? data.imported?.imageUrl ?? null;
  const fallbackArt = artistSongs[0]?.artworkUrl ?? null;

  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      commit({ imageUrl: await fileToAvatar(file, 512) });
    } catch {
      toast.error('Could not read that image.');
    }
  };

  const badges = useMemo(() => badgesForArtist(artist), [artist]);
  const valuation = useMemo(() => {
    const entries = filterEntries(vaultEntries(artistSongs), { artist });
    let total = 0, priced = 0;
    for (const e of entries) if (e.value != null) { total += e.value; priced++; }
    return { total, priced, cards: entries.length };
  }, [artistSongs, artist]);

  // Showcase card for header area
  const topCard = artistSongs[0]?.cards[0];

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex items-center gap-5">
        <button
          onClick={() => fileRef.current?.click()}
          aria-label="Change artist image"
          data-testid="artist-image"
          className="w-24 h-24 rounded-[2rem] bg-white/5 border border-white/10 shrink-0 relative overflow-hidden group active:scale-95 transition-transform"
        >
          {imageUrl || fallbackArt ? (
            <img src={imageUrl ?? fallbackArt!} alt={artist} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <Music2 className="w-9 h-9 text-white/20 absolute inset-0 m-auto" />
          )}
          <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity flex items-center justify-center">
            <Camera className="w-5 h-5 text-white" />
          </div>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />

        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-display font-black tracking-tight text-white truncate mb-1.5" data-testid="artist-name">{artist}</h1>
          {editingBio ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                className="flex-1 min-w-0 h-9 rounded-full bg-white/5 border border-white/10 px-4 text-xs font-semibold italic text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={bioDraft}
                maxLength={120}
                placeholder="A lyric that defines them…"
                onChange={e => setBioDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { commit({ lyricBio: bioDraft.trim() || null }); setEditingBio(false); }
                  if (e.key === 'Escape') setEditingBio(false);
                }}
              />
              <button
                className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shrink-0 active:scale-90 transition-transform"
                onClick={() => { commit({ lyricBio: bioDraft.trim() || null }); setEditingBio(false); }}
                aria-label="Save lyric bio"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              className="inline-flex items-start gap-1.5 max-w-full text-left"
              onClick={() => { setBioDraft(data.lyricBio ?? ''); setEditingBio(true); }}
              data-testid="artist-lyric-bio"
            >
              <Quote className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <span className={cn('text-xs italic leading-relaxed line-clamp-2', data.lyricBio ? 'text-white/70' : 'text-white/30')}>
                {data.lyricBio || 'Add a lyric as their bio'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <section>
          <SectionHeader icon={BadgeCheck} title="Badges" />
          <div className="flex flex-wrap gap-2">
            {badges.map(tier => (
              <span key={tier}
                className="px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border"
                style={{ color: BADGE_COLORS[tier], borderColor: `${BADGE_COLORS[tier]}55`, background: `${BADGE_COLORS[tier]}14` }}
                data-testid={`badge-${tier}`}
              >
                {BADGE_LABELS[tier]}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Valuation */}
      <section>
        <SectionHeader icon={Coins} title="Valuation" />
        <button
          onClick={() => navigate(`/vault?artist=${encodeURIComponent(artist)}`)}
          data-testid="artist-open-vault"
          className="glass-panel rounded-2xl p-5 relative overflow-hidden w-full text-left active:scale-[0.98] transition-transform group"
        >
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-3xl font-display font-black tracking-tight text-white mb-1">{abbreviateValue(valuation.total)}</p>
              <p className="text-xs font-bold text-white/50 mb-2 truncate">{exactValue(valuation.total)}</p>
              <p className="text-xs font-bold uppercase tracking-widest text-white/40">
                {valuation.cards} card{valuation.cards === 1 ? '' : 's'} · Open in Vault
              </p>
            </div>
            <div className="w-11 h-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-active:bg-primary/20 transition-colors">
              <ChevronRight className="w-5 h-5 text-white/60" />
            </div>
          </div>
        </button>
      </section>

      {/* Showcase */}
      <section>
        <SectionHeader icon={Sparkles} title="Showcase" />
        <ShowcaseSection key={artistKey(artist)} scope={{ kind: 'artist', artist }} songs={songs} readOnly={false} />
      </section>

      {/* Releases (albums / EPs / singles grouped) */}
      <ReleasesSection songs={artistSongs} navigate={navigate} />

      {/* All songs flat list */}
      <section>
        <SectionHeader icon={Disc3} title={`All Songs · ${artistSongs.length}`} />
        <div className="space-y-2">
          {artistSongs.map(song => (
            <div key={song.id}
              className="flex items-center gap-3 rounded-2xl glass-panel px-3 py-2.5 active:bg-white/[0.06] transition cursor-pointer"
              onClick={() => navigate(`/song/${encodeURIComponent(song.id)}`)}
              data-testid={`artist-song-${song.id}`}
            >
              <ArtMenu song={song} className="rounded-xl shrink-0">
                {song.artworkUrl
                  ? <img src={song.artworkUrl} alt="" className="w-11 h-11 rounded-xl object-cover" />
                  : <div className="w-11 h-11 rounded-xl bg-white/5" />}
              </ArtMenu>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{song.title}</p>
                <p className="text-xs text-white/40 truncate">{song.album || song.genre || ''}</p>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-white/30 shrink-0">
                {song.cards.length} card{song.cards.length === 1 ? '' : 's'}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Imported artist info */}
      <section>
        <SectionHeader icon={ExternalLink} title="Artist Info" />
        <div className="glass-panel rounded-2xl p-5 space-y-3">
          {data.imported ? (
            <>
              {data.imported.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {data.imported.genres.map(g => (
                    <span key={g} className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-white/60">{g}</span>
                  ))}
                </div>
              )}
              {data.imported.url && (
                <a href={data.imported.url} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-primary">
                  View on Apple Music <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <p className="text-[11px] text-white/30 leading-relaxed">
                Imported from Apple Music. Listener counts, followers, and bios aren't available from the catalog API.
              </p>
            </>
          ) : (
            <p className="text-sm text-white/40">No imported info yet — it loads automatically from Apple Music.</p>
          )}
        </div>
      </section>

      {/* Notes */}
      <section className="pb-4">
        <SectionHeader icon={StickyNote} title="Notes" />
        {editingNotes ? (
          <div className="space-y-2">
            <textarea
              autoFocus
              className="w-full min-h-28 rounded-2xl bg-white/5 border border-white/10 p-4 text-sm text-white leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
              value={notesDraft}
              maxLength={2000}
              placeholder={`Your notes about ${artist}…`}
              onChange={e => setNotesDraft(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                className="px-5 h-10 rounded-full bg-primary text-white text-sm font-bold active:scale-95 transition"
                onClick={() => { commit({ notes: notesDraft.trim() || null }); setEditingNotes(false); }}
                data-testid="save-notes"
              >
                Save
              </button>
              <button className="px-5 h-10 rounded-full bg-white/5 border border-white/10 text-sm font-bold text-white/60" onClick={() => setEditingNotes(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            className="glass-panel rounded-2xl p-5 w-full text-left active:scale-[0.99] transition-transform"
            onClick={() => { setNotesDraft(data.notes ?? ''); setEditingNotes(true); }}
            data-testid="artist-notes"
          >
            <p className={cn('text-sm leading-relaxed whitespace-pre-wrap', data.notes ? 'text-white/80' : 'text-white/30')}>
              {data.notes || 'Tap to add your notes about this artist…'}
            </p>
          </button>
        )}
      </section>
    </div>
  );
}
