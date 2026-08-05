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
import { motion, AnimatePresence } from 'framer-motion';

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

export default function Collection() {
  const { songs, isLoading, refresh, error, isDemoMode } = useMusicKit();
  const { play } = usePlayer();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState('');
  const [activeRarity, setActiveRarity] = useState<string>('All');
  const [showAddSheet, setShowAddSheet] = useState(false);

  const displayData = useMemo(() => {
    const q = search.toLowerCase();
    return songs
      .filter(song => {
        if (q && !song.title.toLowerCase().includes(q) && !song.artist.toLowerCase().includes(q)) return false;
        if (activeRarity !== 'All' && !song.cards.some(c => c.rarityType.name === activeRarity)) return false;
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
    e.preventDefault(); e.stopPropagation();
    play(song, songs); setLocation('/');
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background relative">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
      
      <div className="shrink-0 px-4 pt-8 pb-4 sm:px-6 relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-display font-black tracking-tight text-white">Collection</h1>
            {!isLoading && (
              <p className="text-primary font-semibold text-sm mt-1">
                {displayData.length} {displayData.length === 1 ? 'song' : 'songs'}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={refresh}
              className="w-10 h-10 rounded-full glass-panel flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all active:scale-90"
              aria-label="Refresh" disabled={isLoading}
            >
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </button>
            {!isDemoMode && (
              <button
                onClick={() => setShowAddSheet(true)}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-primary text-white hover:bg-primary/90 transition-all active:scale-95 shadow-lg shadow-primary/30"
                aria-label="Add song"
              >
                <Plus className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <Input
            placeholder="Search songs or artists…"
            className="pl-11 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/40 rounded-2xl focus-visible:ring-primary/50 text-base shadow-inner"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          {DEMO_RARITY_NAMES.map(name => (
            <button
              key={name}
              onClick={() => setActiveRarity(name)}
              className={cn(
                'whitespace-nowrap px-4 py-2 rounded-full text-[13px] font-bold transition-all shrink-0 border',
                activeRarity === name
                  ? 'bg-primary border-primary text-white shadow-[0_0_15px_rgba(255,60,0,0.3)]'
                  : 'bg-card/50 border-white/10 text-white/60 hover:bg-card hover:text-white',
              )}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 relative z-10 pb-20">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-10 h-10 border-4 border-white/10 border-t-primary rounded-full animate-spin shadow-[0_0_15px_rgba(255,60,0,0.5)]" />
            <p className="text-sm font-semibold text-white/60">Loading collection…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
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
            className="flex flex-col items-center justify-center h-full text-center"
          >
            <div className="w-24 h-24 rounded-[2rem] glass-panel flex items-center justify-center mb-6 shadow-2xl">
              <Library className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-display font-bold mb-2 text-white">Empty Binder</h2>
            <p className="text-base text-white/50 mb-8 max-w-[280px] leading-relaxed">
              Search for songs and add them to build your Maplog collection.
            </p>
            {!isDemoMode && (
              <Button size="lg" className="rounded-full font-bold px-8 gap-2 shadow-primary/25 shadow-xl hover:scale-105 transition-transform" onClick={() => setShowAddSheet(true)}>
                <Plus className="w-5 h-5" /> Start Collecting
              </Button>
            )}
          </motion.div>
        ) : displayData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Search className="w-12 h-12 text-white/20 mb-4" />
            <h2 className="text-xl font-bold mb-2 text-white">No matches found</h2>
            <p className="text-sm text-white/50 mb-6 max-w-xs">
              Try a different search term or change your rarity filter.
            </p>
            <Button variant="outline" className="rounded-full" onClick={() => { setSearch(''); setActiveRarity('All'); }}>
              Clear Filters
            </Button>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence>
              {displayData.map(({ song, topCard }, i) => (
                <motion.div
                  key={song.id}
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: i * 0.03, type: "spring", stiffness: 300, damping: 25 }}
                  layout
                >
                  <Link href={`/song/${encodeURIComponent(song.id)}`}>
                    <div className="group flex items-center gap-4 p-3 rounded-2xl glass-panel hover:bg-white/10 hover:border-white/20 transition-all active:scale-[0.98] cursor-pointer">
                      <AlbumArt song={song} topCard={topCard} size={64} />
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <p className="font-bold text-[16px] text-white leading-tight truncate mb-1">{song.title}</p>
                        <p className="text-[13px] text-white/60 truncate mb-1.5">{song.artist}</p>
                        {topCard && (
                          <div className="w-fit">
                            <RarityBadge slug={topCard.rarityType.slug} name={topCard.rarityType.name} category={topCard.rarityType.category} size="sm" />
                          </div>
                        )}
                      </div>
                      <button
                        onClick={e => handlePlay(e, song)}
                        className="shrink-0 w-10 h-10 mr-1 flex items-center justify-center rounded-full bg-white/5 text-white hover:bg-primary hover:text-white hover:shadow-[0_0_15px_rgba(255,60,0,0.5)] active:scale-90 transition-all"
                        aria-label={`Play ${song.title}`}
                      >
                        <Play className="h-4 w-4 fill-current ml-0.5" />
                      </button>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <AddSongSheet open={showAddSheet} onOpenChange={setShowAddSheet} />
    </div>
  );
}
