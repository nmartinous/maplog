import React, { useState, useMemo } from 'react';
import { Link, useLocation } from 'wouter';
import { useMusicKit } from '@/context/MusicKitContext';
import { usePlayer } from '@/context/AudioPlayerContext';
import type { MaplogSong, MaplogCard } from '@/lib/types';
import { DEMO_RARITY_NAMES } from '@/lib/rarityMap';
import { RarityBadge } from '@/components/RarityBadge';
import { AddSongSheet } from '@/components/AddSongSheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Play, Library, Plus, RefreshCw, Music2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Album art thumbnail ───────────────────────────────────────────────────────

function AlbumArt({ song, topCard, size = 56 }: { song: MaplogSong; topCard?: MaplogCard; size?: number }) {
  const url = topCard?.artworkUrl ?? song.artworkUrl;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {url ? (
        <img src={url} alt={song.title} className="w-full h-full object-cover rounded-xl" />
      ) : (
        <div className="w-full h-full rounded-xl bg-muted flex items-center justify-center">
          <Music2 className="w-5 h-5 text-muted-foreground/40" />
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Collection() {
  const { songs, isLoading, refresh, error, isDemoMode } = useMusicKit();
  const { play } = usePlayer();
  const [, setLocation] = useLocation();
  const [search, setSearch]           = useState('');
  const [activeRarity, setActiveRarity] = useState<string>('All');
  const [showAddSheet, setShowAddSheet] = useState(false);

  // ── Filter + sort ──────────────────────────────────────────────────────────
  const displayData = useMemo(() => {
    const q = search.toLowerCase();
    return songs
      .filter(song => {
        if (q && !song.title.toLowerCase().includes(q) && !song.artist.toLowerCase().includes(q)) return false;
        if (activeRarity !== 'All') {
          if (!song.cards.some(c => c.rarityType.name === activeRarity)) return false;
        }
        return true;
      })
      .map(song => {
        const filtered = activeRarity === 'All'
          ? song.cards
          : song.cards.filter(c => c.rarityType.name === activeRarity);
        return { song, topCard: filtered[0] ?? song.cards[0] };
      });
  }, [songs, search, activeRarity]);

  const handlePlay = (e: React.MouseEvent, song: MaplogSong) => {
    e.preventDefault();
    e.stopPropagation();
    play(song, songs);
    setLocation('/');
  };

  // ── Main collection view ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-[100dvh]">

      {/* Header */}
      <div className="px-4 pt-6 pb-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Collection</h1>
          {!isLoading && (
            <p className="text-muted-foreground text-sm mt-0.5">
              {displayData.length} {displayData.length === 1 ? 'song' : 'songs'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/8 transition-all"
            aria-label="Refresh collection"
            disabled={isLoading}
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </button>
          {!isDemoMode && (
            <button
              onClick={() => setShowAddSheet(true)}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
              aria-label="Add song"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="px-4 sm:px-6 lg:px-8 mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search songs or artists..."
            className="pl-9 h-10 bg-card/50 border-border/50 text-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Rarity filter chips */}
      <div className="flex overflow-x-auto pb-3 gap-2 px-4 sm:px-6 lg:px-8 scrollbar-hide shrink-0">
        {DEMO_RARITY_NAMES.map(name => (
          <button
            key={name}
            onClick={() => setActiveRarity(name)}
            className={cn(
              'whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0',
              activeRarity === name
                ? 'bg-primary text-primary-foreground'
                : 'bg-card/60 text-muted-foreground hover:bg-card hover:text-foreground border border-border/40'
            )}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Song list */}
      <div className="flex-1 overflow-y-auto pb-nav sm:pb-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-6 h-6 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Loading…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
            <p className="text-destructive text-sm mb-4">{error}</p>
            <Button variant="outline" size="sm" onClick={refresh}>Try again</Button>
          </div>
        ) : songs.length === 0 ? (
          /* Empty collection — first-run state */
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
            <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
              <Library className="w-10 h-10 text-primary/60" />
            </div>
            <h2 className="text-xl font-bold mb-2">Your collection is empty</h2>
            <p className="text-sm text-muted-foreground mb-8 max-w-xs leading-relaxed">
              Search for songs from Deezer and add them to your collection with a rarity tier.
            </p>
            {!isDemoMode && (
              <Button
                className="rounded-full font-bold px-6 gap-2"
                onClick={() => setShowAddSheet(true)}
              >
                <Plus className="w-4 h-4" />
                Add your first song
              </Button>
            )}
          </div>
        ) : displayData.length === 0 ? (
          /* Filter returned nothing */
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
            <h2 className="text-lg font-bold mb-2">No matches</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              Try different search terms or clear the filter.
            </p>
            <Button variant="outline" size="sm" onClick={() => { setSearch(''); setActiveRarity('All'); }}>
              Clear filters
            </Button>
          </div>
        ) : (
          <div>
            {displayData.map(({ song, topCard }, i) => (
              <Link key={song.id} href={`/song/${encodeURIComponent(song.id)}`}>
                <div className={cn(
                  'flex items-center gap-3.5 px-4 sm:px-6 lg:px-8 py-3 transition-colors',
                  'hover:bg-white/[0.04] active:bg-white/[0.06]',
                  i !== displayData.length - 1 && 'border-b border-border/20'
                )}>
                  <AlbumArt song={song} topCard={topCard} size={56} />

                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[15px] leading-tight truncate text-foreground">{song.title}</p>
                    <p className="text-sm text-muted-foreground truncate mt-0.5 leading-tight">{song.artist}</p>
                  </div>

                  {topCard ? (
                    <RarityBadge
                      slug={topCard.rarityType.slug}
                      name={topCard.rarityType.name}
                      category={topCard.rarityType.category}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground/50 shrink-0">—</span>
                  )}

                  <button
                    onClick={e => handlePlay(e, song)}
                    className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all"
                    aria-label={`Play ${song.title}`}
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                  </button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Add Song Sheet */}
      <AddSongSheet open={showAddSheet} onOpenChange={setShowAddSheet} />
    </div>
  );
}
