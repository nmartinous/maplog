import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, Music2, Quote, StickyNote, Coins, ChevronRight, Camera,
  BadgeCheck, Sparkles, Disc3, ExternalLink, Check, Shuffle,
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

const CYCLE_MS = 60_000;

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <Icon className="w-5 h-5 text-primary" />
      <h2 className="text-sm font-bold tracking-widest uppercase text-white/80">{title}</h2>
    </div>
  );
}

/**
 * Artist pages — one page per artist in the collection. `/artists` shows a
 * random artist and cycles to another every minute while idle; picking an
 * artist via search (or deep link `/artists/:name`) pins that artist.
 */
export default function Artist() {
  const { songs, isDemoMode } = useMusicKit();
  const { play } = usePlayer();
  const [, navigate] = useLocation();
  const [, params] = useRoute('/artists/:name');
  const pinnedName = params?.name ? decodeURIComponent(params.name) : null;

  // Unique artists present in the collection
  const artists = useMemo(() => {
    const map = new Map<string, string>(); // key → display name
    for (const s of songs) {
      const k = artistKey(s.artist);
      if (!map.has(k)) map.set(k, s.artist);
    }
    return [...map.values()].sort((a, b) => a.localeCompare(b));
  }, [songs]);

  // Random pick + idle cycling (only when not pinned)
  const [pick, setPick] = useState(() => Math.floor(Math.random() * Math.max(artists.length, 1)));
  useEffect(() => {
    if (pinnedName || artists.length < 2) return;
    const t = setInterval(() => {
      setPick(prev => {
        let next = Math.floor(Math.random() * (artists.length - 1));
        if (next >= prev) next += 1;
        return next;
      });
    }, CYCLE_MS);
    return () => clearInterval(t);
  }, [pinnedName, artists.length]);

  const artist = pinnedName && artists.some(a => artistKey(a) === artistKey(pinnedName))
    ? artists.find(a => artistKey(a) === artistKey(pinnedName))!
    : artists[pick % Math.max(artists.length, 1)] ?? null;

  // ── Search ────────────────────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return artists.filter(a => a.toLowerCase().includes(q)).slice(0, 8);
  }, [query, artists]);

  if (artists.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center bg-background">
        <Music2 className="h-14 w-14 text-white/10 mb-6" />
        <h2 className="text-xl font-display font-bold text-white mb-2">No Artists Yet</h2>
        <p className="text-white/50 text-sm max-w-xs leading-relaxed">Artists appear here once you add songs to your collection.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden scrollbar-hide bg-background pb-20">
      <div className="px-4 sm:px-6 pt-6 relative z-10">
        {/* ── Search bar ── */}
        <div className="relative mb-6 z-30">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search your artists"
                data-testid="artist-search"
                className="w-full h-11 rounded-2xl bg-white/5 border border-white/10 pl-11 pr-10 text-sm font-semibold text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              {query && (
                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40" onClick={() => setQuery('')} aria-label="Clear search">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {pinnedName && (
              <button
                className="h-11 px-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-2 text-xs font-bold text-white/60 active:scale-95 transition"
                onClick={() => navigate('/artists')}
                data-testid="unpin-artist"
              >
                <Shuffle className="w-3.5 h-3.5" /> Shuffle
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
                    data-testid={`artist-result-${artistKey(a)}`}
                  >
                    {a}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {artist && (
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={artist}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
            >
              <ArtistPage artist={artist} songs={songs} isDemoMode={isDemoMode} play={play} navigate={navigate} />
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

function ArtistPage({ artist, songs, isDemoMode, play, navigate }: {
  artist: string;
  songs: MaplogSong[];
  isDemoMode: boolean;
  play: (song: MaplogSong, queue: MaplogSong[]) => void;
  navigate: (to: string) => void;
}) {
  const artistSongs = useMemo(
    () => songs.filter(s => artistKey(s.artist) === artistKey(artist)),
    [songs, artist],
  );

  // ── Persisted artist data (image, lyric bio, notes, imported info) ────────
  const [data, setData] = useState<ArtistData>(() => loadArtistData(artist));
  useEffect(() => { setData(loadArtistData(artist)); }, [artist]);

  const commit = (patch: Partial<ArtistData>) => {
    if (saveArtistData(artist, patch)) {
      setData(d => ({ ...d, ...patch }));
    } else {
      toast.error("Couldn't save — storage is full.");
    }
  };

  // Auto-import Apple Music info (refreshed weekly); demo mode skips network
  useEffect(() => {
    if (isDemoMode) return;
    const current = loadArtistData(artist);
    if (importedInfoIsFresh(current)) return;
    let cancelled = false;
    importArtistInfo(artist).then(info => {
      if (!cancelled && info) setData(d => ({ ...d, imported: info }));
    });
    return () => { cancelled = true; };
  }, [artist, isDemoMode]);

  const imageUrl = data.imageUrl ?? data.imported?.imageUrl ?? null;
  const fallbackArt = artistSongs[0]?.artworkUrl ?? null;

  // ── Editable lyric bio & notes ─────────────────────────────────────────────
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

  // ── Badges & valuation ────────────────────────────────────────────────────
  const badges = useMemo(() => badgesForArtist(artist), [artist]);
  const valuation = useMemo(() => {
    const entries = filterEntries(vaultEntries(artistSongs), { artist });
    let total = 0, priced = 0;
    for (const e of entries) if (e.value != null) { total += e.value; priced++; }
    return { total, priced, cards: entries.length };
  }, [artistSongs, artist]);

  return (
    <div className="space-y-10">
      {/* ── Header: image, name, lyric bio ── */}
      <div className="flex items-center gap-5">
        <button
          onClick={() => !isDemoMode && fileRef.current?.click()}
          aria-label="Change artist image"
          data-testid="artist-image"
          className="w-24 h-24 rounded-[2rem] bg-white/5 border border-white/10 shrink-0 relative overflow-hidden group active:scale-95 transition-transform"
        >
          {imageUrl || fallbackArt ? (
            <img src={imageUrl ?? fallbackArt!} alt={artist} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <Music2 className="w-9 h-9 text-white/20 absolute inset-0 m-auto" />
          )}
          {!isDemoMode && (
            <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </div>
          )}
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
              onClick={() => { if (!isDemoMode) { setBioDraft(data.lyricBio ?? ''); setEditingBio(true); } }}
              data-testid="artist-lyric-bio"
            >
              <Quote className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <span className={cn('text-xs italic leading-relaxed line-clamp-2', data.lyricBio ? 'text-white/70' : 'text-white/30')}>
                {data.lyricBio || (isDemoMode ? 'No lyric bio' : 'Add a lyric as their bio')}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ── Badges ── */}
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

      {/* ── Valuation summary ── */}
      <section>
        <SectionHeader icon={Coins} title="Valuation" />
        <button
          onClick={() => navigate(`/vault?artist=${encodeURIComponent(artist)}`)}
          data-testid="artist-open-vault"
          className="glass-panel rounded-[1.75rem] p-5 relative overflow-hidden w-full text-left active:scale-[0.98] transition-transform group"
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

      {/* ── Showcase ── */}
      <section>
        <SectionHeader icon={Sparkles} title="Showcase" />
        <ShowcaseSection key={artistKey(artist)} scope={{ kind: 'artist', artist }} songs={songs} readOnly={isDemoMode} />
      </section>

      {/* ── Songs ── */}
      <section>
        <SectionHeader icon={Disc3} title={`Songs · ${artistSongs.length}`} />
        <div className="space-y-2">
          {artistSongs.map(song => (
            <div key={song.id}
              className="flex items-center gap-3 rounded-2xl bg-white/[0.03] border border-white/5 px-3 py-2.5 active:bg-white/[0.06] transition cursor-pointer"
              onClick={() => navigate(`/song/${encodeURIComponent(song.id)}`)}
              data-testid={`artist-song-${song.id}`}
            >
              {song.artworkUrl
                ? <img src={song.artworkUrl} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0" />
                : <div className="w-11 h-11 rounded-xl bg-white/5 shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{song.title}</p>
                <p className="text-xs text-white/40 truncate">{song.album || song.genre || ''}</p>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-white/30 shrink-0">
                {song.cards.length} card{song.cards.length === 1 ? '' : 's'}
              </span>
              <button
                className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 active:scale-90 transition"
                onClick={e => { e.stopPropagation(); play(song, artistSongs); }}
                aria-label={`Play ${song.title}`}
              >
                <Music2 className="w-4 h-4 text-white/60" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── Imported artist info ── */}
      <section>
        <SectionHeader icon={ExternalLink} title="Artist Info" />
        <div className="glass-panel rounded-[1.75rem] p-5 space-y-3">
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
            <p className="text-sm text-white/40">
              {isDemoMode
                ? 'Artist info imports are disabled in demo mode.'
                : 'No imported info yet — it loads automatically from Apple Music.'}
            </p>
          )}
        </div>
      </section>

      {/* ── Notes ── */}
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
            className="glass-panel rounded-[1.75rem] p-5 w-full text-left active:scale-[0.99] transition-transform"
            onClick={() => { if (!isDemoMode) { setNotesDraft(data.notes ?? ''); setEditingNotes(true); } }}
            data-testid="artist-notes"
          >
            <p className={cn('text-sm leading-relaxed whitespace-pre-wrap', data.notes ? 'text-white/80' : 'text-white/30')}>
              {data.notes || (isDemoMode ? 'No notes' : 'Tap to add your notes about this artist…')}
            </p>
          </button>
        )}
      </section>
    </div>
  );
}
