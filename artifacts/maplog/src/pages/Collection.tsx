import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'wouter';
import { useMusicKit } from '@/context/MusicKitContext';
import type { MaplogSong, MaplogCard } from '@/lib/types';
import { ALL_CATEGORIES, CATEGORY_SLUG } from '@/lib/rarityMap';
import { RarityBadge } from '@/components/RarityBadge';
import { Input } from '@/components/ui/input';
import {
  Search, Play, Library, Music2, ChevronDown, SlidersHorizontal, X,
  CreditCard, User,
} from 'lucide-react';
import { ArtMenu } from '@/components/ArtMenu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// ── Search scope ───────────────────────────────────────────────────────────────
type SearchScope = 'all' | 'song' | 'artist' | 'album';
const SCOPE_LABELS: Record<SearchScope, string> = {
  all: 'All', song: 'Song', artist: 'Artist', album: 'Album',
};

// ── Album art thumbnail with sized CDN URL ─────────────────────────────────────
function AlbumArt({ song, topCard, size = 44 }: { song: MaplogSong; topCard?: MaplogCard; size?: number }) {
  const rawUrl = topCard?.artworkUrl ?? song.artworkUrl;
  const px = Math.ceil(size * Math.min(window.devicePixelRatio || 2, 3));
  const url = rawUrl
    ? rawUrl
        .replace(/\{w\}/g, String(px))
        .replace(/\{h\}/g, String(px))
        .replace(/\d+x\d+bb/, `${px}x${px}bb`)
    : undefined;
  return (
    <div className="shrink-0" style={{ width: size, height: size }}>
      {url
        ? <img src={url} alt={song.title} className="w-full h-full object-cover rounded-xl" decoding="async" />
        : <div className="w-full h-full rounded-xl bg-muted flex items-center justify-center">
            <Music2 className="w-4 h-4 text-muted-foreground/40" />
          </div>
      }
    </div>
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
  songs, isLoading, error,
}: {
  songs: MaplogSong[];
  isLoading: boolean;
  error: string | null;
}) {
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
        <div className="mb-6">
          <h1 className="text-3xl font-display font-black tracking-tight text-white">Collection</h1>
          {!isLoading && (
            <p className="text-primary font-semibold text-sm mt-1">
              {displayData.length} {displayData.length === 1 ? 'song' : 'songs'}
            </p>
          )}
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
            <Button variant="outline" onClick={() => window.location.reload()} className="rounded-full">Try again</Button>
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
              <div key={song.id} className="flex items-center gap-2.5 pl-2 pr-3 py-2 rounded-2xl glass-panel">
                {/* Art — display only, no interaction */}
                <div className="shrink-0">
                  <AlbumArt song={song} topCard={topCard} size={52} />
                </div>

                {/* Stacked: title / artist / rarity badge */}
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-white truncate leading-tight">
                    {song.title.length > 20 ? song.title.slice(0, 20) + '…' : song.title}
                  </p>
                  <p className="text-[12px] text-white/50 truncate mt-0.5">
                    {song.artist.length > 22 ? song.artist.slice(0, 22) + '…' : song.artist}
                  </p>
                  {topCard && (
                    <div className="w-fit mt-1">
                      <RarityBadge slug={topCard.rarityType.slug} name={topCard.rarityType.name} category={topCard.rarityType.category} size="sm" />
                    </div>
                  )}
                </div>

                {/* Play / Add to Queue */}
                <ArtMenu song={song}>
                  <div className="w-9 h-9 rounded-full bg-primary/15 hover:bg-primary/25 active:bg-primary/35 flex items-center justify-center transition-colors shrink-0">
                    <Play className="w-4 h-4 text-primary fill-primary ml-0.5" />
                  </div>
                </ArtMenu>

                {/* Open card view */}
                <button
                  onClick={() => navigate(`/song/${encodeURIComponent(song.id)}`)}
                  className="shrink-0 w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 flex items-center justify-center transition-colors"
                  aria-label={`Open card for ${song.title}`}
                >
                  <CreditCard className="w-3.5 h-3.5 text-white/45" />
                </button>

                {/* Open artist page */}
                <button
                  onClick={() => navigate(`/artists/${encodeURIComponent(song.artist)}`)}
                  className="shrink-0 w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 flex items-center justify-center transition-colors"
                  aria-label={`View artist ${song.artist}`}
                >
                  <User className="w-3.5 h-3.5 text-white/45" />
                </button>
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
  const { songs, isLoading, error } = useMusicKit();
  return (
    <div className="h-full w-full relative overflow-hidden">
      <ActiveView songs={songs} isLoading={isLoading} error={error} />
    </div>
  );
}
