import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'wouter';
import { useMusicKit } from '@/context/MusicKitContext';
import { usePlayer } from '@/context/AudioPlayerContext';
import type { MaplogSong, MaplogCard } from '@/lib/types';
import { ALL_CATEGORIES, CATEGORY_SLUG } from '@/lib/rarityMap';
import { RarityBadge } from '@/components/RarityBadge';
import { SoundmapCard } from '@/components/SoundmapCard';
import { Input } from '@/components/ui/input';
import {
  Search, Play, Library, RefreshCw, Music2, Layers, ChevronDown, SlidersHorizontal, X,
} from 'lucide-react';
import { ArtMenu } from '@/components/ArtMenu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// ── Mode toggle ────────────────────────────────────────────────────────────────
// Persisted in sessionStorage so a reload resets to active (grid) view.
type Mode = 'active' | 'passive';

// ── Search scope ───────────────────────────────────────────────────────────────
type SearchScope = 'all' | 'song' | 'artist' | 'album';
const SCOPE_LABELS: Record<SearchScope, string> = {
  all: 'All', song: 'Song', artist: 'Artist', album: 'Album',
};

const CYCLE_MS = 5000;

// ── Album art helper ───────────────────────────────────────────────────────────
function AlbumArt({ song, topCard, size = 52 }: { song: MaplogSong; topCard?: MaplogCard; size?: number }) {
  const url = topCard?.artworkUrl ?? song.artworkUrl;
  return (
    <div className="shrink-0 relative group" style={{ width: size, height: size }}>
      {url
        ? (
          <>
            <img src={url} alt={song.title} className="w-full h-full object-cover rounded-xl relative z-10" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent rounded-xl z-10 opacity-0 group-hover:opacity-100 transition-opacity" />
          </>
        )
        : <div className="w-full h-full rounded-xl bg-muted flex items-center justify-center relative z-10">
            <Music2 className="w-5 h-5 text-muted-foreground/40" />
          </div>
      }
    </div>
  );
}

// ── Passive (showcase) mode ────────────────────────────────────────────────────
function PassiveView({
  songs, onToggle,
}: {
  songs: MaplogSong[];
  onToggle: () => void;
}) {
  const { currentSong, play } = usePlayer();
  const [, navigate] = useLocation();

  const pool = useMemo(() => {
    if (currentSong) {
      const active = songs.find(s => s.id === currentSong.id);
      return active ? [active] : songs.filter(s => s.cards.length > 0);
    }
    return songs.filter(s => s.cards.length > 0);
  }, [songs, currentSong]);

  const [pick, setPick] = useState(() =>
    pool.length ? Math.floor(Math.random() * pool.length) : 0,
  );
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (currentSong || pool.length < 2) return;
    const t = setInterval(() => {
      setPick(prev => {
        if (pool.length < 2) return prev;
        let next = Math.floor(Math.random() * (pool.length - 1));
        if (next >= prev) next += 1;
        return next;
      });
      setCycle(c => c + 1);
    }, CYCLE_MS);
    return () => clearInterval(t);
  }, [currentSong, pool.length]);

  const song = pool[pick % Math.max(pool.length, 1)];
  const card = song?.cards[0];

  if (!song || !card) {
    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
        className="h-full w-full flex flex-col items-center justify-center p-6 text-center relative z-10 overflow-hidden bg-background"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none -z-10" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative flex flex-col items-center w-full max-w-sm"
        >
          <div className="w-28 h-28 rounded-[2.5rem] glass-panel flex items-center justify-center mb-8 relative z-10 shadow-2xl border-white/10 overflow-hidden">
            <Music2 className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-black mb-4 text-white tracking-tight">Music Binder</h1>
          <p className="text-white/50 text-sm sm:text-base mb-10 leading-relaxed font-medium">
            Your collection is waiting. Add songs to reveal your cards.
          </p>
          <Button size="lg" onClick={onToggle} className="rounded-full font-bold px-8 h-14 shadow-[0_0_40px_-10px_rgba(255,60,0,0.5)] hover:scale-105 active:scale-95 transition-all text-base bg-primary text-white flex items-center gap-3">
            <Library className="h-5 w-5" />
            Open Collection
          </Button>
        </motion.div>

        {/* Mode toggle */}
        <ToggleButton mode="passive" onToggle={onToggle} className="absolute top-6 right-4 sm:right-6" />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
      className="h-full flex flex-col overflow-hidden relative bg-background w-full"
    >
      {/* Blurred artwork ambience */}
      <AnimatePresence>
        {card.artworkUrl && (
          <motion.div
            key={card.artworkUrl}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 z-0 pointer-events-none overflow-hidden"
          >
            <img
              src={card.artworkUrl}
              alt=""
              className="absolute top-0 left-0 w-full h-[60%] object-cover blur-[80px] scale-150 transform-gpu"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background to-background" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header row with toggle */}
      <div className="relative z-20 flex items-center justify-between px-5 pt-8 pb-2 shrink-0">
        <span className="text-[11px] font-black tracking-[0.3em] uppercase text-primary animate-pulse">
          {currentSong ? 'Now Playing' : 'Dive in?'}
        </span>
        <ToggleButton mode="passive" onToggle={onToggle} />
      </div>

      <div className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center px-4 w-full overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={`${song.id}-${cycle}`}
            initial={{ x: 320, opacity: 0, rotate: 4 }}
            animate={{ x: 0, opacity: 1, rotate: 0 }}
            exit={{ x: -320, opacity: 0, rotate: -4 }}
            transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
            whileTap={{ scale: 0.95 }}
            style={{ willChange: 'transform' }}
            className="cursor-pointer"
            onClick={() => navigate(`/song/${encodeURIComponent(song.id)}`)}
            role="button"
            aria-label={`View ${song.title}`}
          >
            <SoundmapCard
              card={card}
              title={song.title}
              artist={song.artist}
              genre={song.genre}
              size="lg"
              className="shadow-2xl"
            />
          </motion.div>
        </AnimatePresence>
        {!currentSong && (
          <button
            className="mt-5 text-xs font-semibold text-white/40 shrink-0 flex items-center gap-2 active:text-white/70 transition-colors"
            onClick={() => play(song, songs.filter(s => s.cards.length > 0))}
          >
            <Play className="h-3 w-3 fill-current" />
            Tap to play
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ── Toggle button (same design in both modes) ──────────────────────────────────
function ToggleButton({ mode, onToggle, className }: { mode: Mode; onToggle: () => void; className?: string }) {
  return (
    <button
      onClick={onToggle}
      aria-label={mode === 'active' ? 'Switch to showcase view' : 'Switch to collection view'}
      className={cn(
        'w-9 h-9 rounded-full glass-panel flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all active:scale-90 z-20',
        className,
      )}
    >
      {mode === 'active'
        ? <Layers className="h-4 w-4" />
        : <Library className="h-4 w-4" />
      }
    </button>
  );
}

// ── Scope selector — horizontal row, opens to the LEFT ────────────────────────
function ScopeSelect({ value, onChange }: { value: SearchScope; onChange: (v: SearchScope) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0 flex items-center">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: 8, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-full mr-2 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-2xl bg-[#141417] border border-white/10 shadow-2xl p-1 z-50"
          >
            {(Object.entries(SCOPE_LABELS) as [SearchScope, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => { onChange(k); setOpen(false); }}
                className={cn(
                  'px-3 py-1.5 text-sm font-bold rounded-xl transition-colors whitespace-nowrap',
                  k === value ? 'bg-primary text-white' : 'text-white/70 hover:bg-white/5 hover:text-white',
                )}
              >
                {label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={() => setOpen(o => !o)}
        className="h-12 px-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-1.5 text-sm font-bold text-white/70 hover:text-white hover:bg-white/10 transition-all active:scale-95 whitespace-nowrap"
        aria-label="Search scope"
      >
        {SCOPE_LABELS[value]}
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
      </button>
    </div>
  );
}

// ── Rarity filter popup ────────────────────────────────────────────────────────
function FilterPopup({
  isOpen, activeRarity, onSelect, onClose,
}: {
  isOpen: boolean;
  activeRarity: string;
  onSelect: (v: string) => void;
  onClose: () => void;
}) {
  const categories = ALL_CATEGORIES.filter(c => c !== 'All');
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#0f0f12] border-t border-white/10 rounded-t-3xl px-4 pt-4 shadow-2xl"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}
          >
            {/* Handle */}
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />

            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white text-base">Filter by Rarity</h3>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* All option */}
            <button
              onClick={() => { onSelect('All'); onClose(); }}
              className={cn(
                'w-full py-2.5 px-4 rounded-2xl font-bold text-sm mb-3 border transition-all active:scale-[0.98]',
                activeRarity === 'All'
                  ? 'bg-primary/20 border-primary text-primary shadow-[0_0_12px_rgba(255,60,0,0.2)]'
                  : 'bg-white/5 border-white/10 text-white/60 hover:text-white',
              )}
            >
              All Rarities
            </button>

            {/* Category pills — wrapping flex grid */}
            <div className="flex flex-wrap gap-2 pb-1">
              {categories.map(category => {
                const isActive = activeRarity === category;
                return (
                  <button
                    key={category}
                    onClick={() => { onSelect(category); onClose(); }}
                    className={cn(
                      'rounded-full transition-all active:scale-95',
                      isActive
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0f0f12] scale-105'
                        : 'opacity-70 hover:opacity-100',
                    )}
                  >
                    <RarityBadge
                      slug={CATEGORY_SLUG[category] ?? 'regular-common'}
                      name={category}
                      category={category}
                      size="md"
                      labelOverride={category}
                    />
                  </button>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

// ── Active (grid) mode ─────────────────────────────────────────────────────────
function ActiveView({
  songs, isLoading, error, refresh, onToggle,
}: {
  songs: MaplogSong[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
  onToggle: () => void;
}) {
  const { play } = usePlayer();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<SearchScope>('all');
  const [activeRarity, setActiveRarity] = useState<string>('All');
  const [filterOpen, setFilterOpen] = useState(false);

  const displayData = useMemo(() => {
    const q = search.toLowerCase();
    return songs
      .filter(song => {
        if (q) {
          const inSong   = song.title.toLowerCase().includes(q);
          const inArtist = song.artist.toLowerCase().includes(q);
          const inAlbum  = song.album.toLowerCase().includes(q);
          const match =
            scope === 'all'    ? (inSong || inArtist || inAlbum) :
            scope === 'song'   ? inSong :
            scope === 'artist' ? inArtist :
            /* album */          inAlbum;
          if (!match) return false;
        }
        if (activeRarity !== 'All' && !song.cards.some(c => c.rarityType.category === activeRarity)) return false;
        return true;
      })
      .map(song => {
        const filtered = activeRarity === 'All'
          ? song.cards
          : song.cards.filter(c => c.rarityType.category === activeRarity);
        return { song, topCard: filtered[0] ?? song.cards[0] };
      });
  }, [songs, search, scope, activeRarity]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
      className="h-full w-full max-w-full flex flex-col overflow-hidden overflow-x-clip bg-background relative"
    >
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />

      <div className="page-top shrink-0 px-4 pb-2 sm:px-6 relative z-10 w-full overflow-x-hidden">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-display font-black tracking-tight text-white">Collection</h1>
            {!isLoading && (
              <p className="text-primary font-semibold text-sm mt-1">
                {displayData.length} {displayData.length === 1 ? 'song' : 'songs'}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              className="w-9 h-9 rounded-full glass-panel flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all active:scale-90"
              aria-label="Refresh" disabled={isLoading}
            >
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </button>
            <ToggleButton mode="active" onToggle={onToggle} />
          </div>
        </div>

        {/* Search row with scope selector */}
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <Input
              placeholder={`Search ${scope === 'all' ? 'songs, artists, albums…' : SCOPE_LABELS[scope].toLowerCase() + 's…'}`}
              className="pl-11 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/40 rounded-2xl focus-visible:ring-primary/50 text-base shadow-inner"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <ScopeSelect value={scope} onChange={setScope} />
        </div>

        {/* Filter trigger */}
        <div className="flex items-center gap-2 pb-2">
          <button
            onClick={() => setFilterOpen(true)}
            className={cn(
              'flex items-center gap-2 h-9 px-4 rounded-full text-sm font-bold border transition-all active:scale-95',
              activeRarity !== 'All'
                ? 'border-primary bg-primary/10 text-primary shadow-[0_0_10px_rgba(255,60,0,0.15)]'
                : 'border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10',
            )}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {activeRarity === 'All' ? 'Filter' : activeRarity}
          </button>
          {activeRarity !== 'All' && (
            <button
              onClick={() => setActiveRarity('All')}
              className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/20 transition-colors"
              aria-label="Clear filter"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <FilterPopup
          isOpen={filterOpen}
          activeRarity={activeRarity}
          onSelect={setActiveRarity}
          onClose={() => setFilterOpen(false)}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 sm:px-6 relative z-10 pb-20 w-full">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 w-full">
            <div className="w-10 h-10 border-4 border-white/10 border-t-primary rounded-full animate-spin shadow-[0_0_15px_rgba(255,60,0,0.5)]" />
            <p className="text-sm font-semibold text-white/60">Loading collection…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-center w-full">
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-4">
              <Music2 className="w-8 h-8" />
            </div>
            <p className="text-destructive font-bold mb-4">{error}</p>
            <Button variant="outline" onClick={refresh} className="rounded-full">Try again</Button>
          </div>
        ) : songs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full text-center w-full"
          >
            <div className="w-24 h-24 rounded-[2rem] glass-panel flex items-center justify-center mb-6 shadow-2xl">
              <Library className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-display font-bold mb-2 text-white">Empty Binder</h2>
            <p className="text-base text-white/50 mb-8 max-w-[280px] leading-relaxed">
              Link your rarity playlists in Settings and refresh to build your Maplog collection.
            </p>
          </motion.div>
        ) : displayData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center w-full">
            <Search className="w-12 h-12 text-white/20 mb-4" />
            <h2 className="text-xl font-bold mb-2 text-white">No matches found</h2>
            <p className="text-sm text-white/50 mb-6 max-w-xs">
              Try a different search term or change your filters.
            </p>
            <Button variant="outline" className="rounded-full" onClick={() => { setSearch(''); setActiveRarity('All'); setScope('all'); }}>
              Clear Filters
            </Button>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 w-full">
            {displayData.map(({ song, topCard }) => (
              <div key={song.id}>
                  {/* Row: tap art to play, tap rest to open card view.
                      Using div + onClick (not Link) to avoid iOS double-tap
                      with nested interactive elements. */}
                  <div
                    className="group flex items-center gap-3 p-2 rounded-2xl glass-panel hover:bg-white/10 hover:border-white/20 transition-all active:scale-[0.98] cursor-pointer"
                    onClick={() => navigate(`/song/${encodeURIComponent(song.id)}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && navigate(`/song/${encodeURIComponent(song.id)}`)}
                  >
                    {/* Album art — tap opens play/queue menu */}
                    <ArtMenu song={song} className="shrink-0 rounded-xl active:scale-90 transition-transform">
                      <div className="relative">
                        <AlbumArt song={song} topCard={topCard} size={50} />
                        <span className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <Play className="h-5 w-5 text-white fill-white ml-0.5" />
                        </span>
                      </div>
                    </ArtMenu>

                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <p className="font-bold text-[14px] text-white leading-tight truncate mb-0.5">{song.title}</p>
                      {/* Artist name — tap navigates to artist page */}
                      <button
                        className="text-[12px] text-white/60 truncate mb-1 text-left hover:text-primary transition-colors active:text-primary w-full"
                        onClick={e => { e.stopPropagation(); navigate(`/artists/${encodeURIComponent(song.artist)}`); }}
                        aria-label={`View ${song.artist}`}
                      >
                        {song.artist}
                      </button>
                      {topCard && (
                        <div className="w-fit">
                          <RarityBadge slug={topCard.rarityType.slug} name={topCard.rarityType.name} category={topCard.rarityType.category} size="sm" />
                        </div>
                      )}
                    </div>
                  </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Page root ──────────────────────────────────────────────────────────────────

export default function Collection() {
  const { songs, isLoading, refresh, error } = useMusicKit();
  const [mode, setMode] = useState<Mode>('active');

  const toggle = () => setMode(m => m === 'active' ? 'passive' : 'active');

  return (
    <div className="h-full w-full relative overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false}>
        {mode === 'active' ? (
          <motion.div
            key="active"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0"
          >
            <ActiveView
              songs={songs}
              isLoading={isLoading}
              error={error}
              refresh={refresh}
              onToggle={toggle}
            />
          </motion.div>
        ) : (
          <motion.div
            key="passive"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0"
          >
            <PassiveView songs={songs} onToggle={toggle} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
