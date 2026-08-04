import React, { useState, useMemo } from 'react';
import { useListSongs, useListCollectedCards, Song, CollectedCard } from '@workspace/api-client-react';
import { Link, useLocation } from 'wouter';
import { RarityBadge } from '@/components/RarityBadge';
import { Input } from '@/components/ui/input';
import { Search, Play, Library, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlayer } from '@/context/AudioPlayerContext';
import { Button } from '@/components/ui/button';

const CATEGORIES = ['All', 'Regular', 'Shiny', 'Epic', 'Special Edition', 'Special Epic', 'Streak Epic', 'Lyric', 'Radiant', 'Moment'];

// Deterministic gradient from artist name for album art placeholder
function artistGradient(artist: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < artist.length; i++) {
    hash = artist.charCodeAt(i) + ((hash << 5) - hash);
  }
  const palettes: [string, string][] = [
    ['#1a0533', '#0d1f3c'], // purple→navy
    ['#0f2b1a', '#0a1a2e'], // green→navy
    ['#2b0f0f', '#1a0e2b'], // red→purple
    ['#1a1a0a', '#0a2020'], // olive→teal
    ['#0f1a2b', '#1a0f2b'], // blue→purple
    ['#2b1a0a', '#1a0f0a'], // amber→brown
    ['#0a1a0a', '#0f0f2b'], // green→blue
    ['#2b0a1a', '#0f1a1a'], // pink→teal
  ];
  return palettes[Math.abs(hash) % palettes.length];
}

function AlbumArt({ song, topCard, size = 56 }: { song: Song; topCard?: CollectedCard; size?: number }) {
  const artworkUrl = topCard?.artworkUrl;
  const [from, to] = artistGradient(song.artist);
  const initials = song.title.charAt(0).toUpperCase();

  // Show variant number overlay for numbered epics (#031, #2, etc.)
  const isNumbered = topCard?.variantLabel?.startsWith('#');

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {artworkUrl ? (
        <img
          src={artworkUrl}
          alt={song.title}
          className="w-full h-full object-cover rounded-xl"
        />
      ) : (
        <div
          className="w-full h-full rounded-xl flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }}
        >
          <span className="text-white/60 font-bold" style={{ fontSize: size * 0.38 }}>
            {initials}
          </span>
        </div>
      )}

      {/* Number overlay for numbered epics */}
      {isNumbered && (
        <div className="absolute -top-1.5 -right-1.5 bg-amber-400 text-black text-[9px] font-black px-1 py-0.5 rounded-full leading-none">
          {topCard.variantLabel}
        </div>
      )}
    </div>
  );
}

export default function Collection() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const { play } = usePlayer();
  const [, setLocation] = useLocation();

  const { data: songs, isLoading: isLoadingSongs } = useListSongs({ limit: 1000 });
  const { data: allCards, isLoading: isLoadingCards } = useListCollectedCards({ limit: 5000 });

  const displayData = useMemo(() => {
    if (!songs || !allCards) return [];

    const cardsBySongId = new Map<number, CollectedCard[]>();
    for (const card of allCards) {
      if (!cardsBySongId.has(card.songId)) cardsBySongId.set(card.songId, []);
      cardsBySongId.get(card.songId)!.push(card);
    }

    const filtered = songs.filter(song => {
      if (!search) return true;
      const q = search.toLowerCase();
      return song.title.toLowerCase().includes(q) || song.artist.toLowerCase().includes(q);
    });

    const items = filtered.map(song => {
      const cards = (cardsBySongId.get(song.id) || [])
        .slice()
        .sort((a, b) => b.rarityType.tier - a.rarityType.tier);
      return { song, topCard: cards[0], cards };
    });

    if (activeCategory === 'All') return items;
    return items.filter(item => item.cards.some(c => c.rarityType.category === activeCategory));
  }, [songs, allCards, search, activeCategory]);

  const isLoading = isLoadingSongs || isLoadingCards;

  const handlePlay = (e: React.MouseEvent, song: Song) => {
    e.preventDefault();
    e.stopPropagation();
    play(song);
    setLocation('/');
  };

  return (
    <div className="flex flex-col h-full min-h-[100dvh] animate-in fade-in">
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
        <Link href="/add">
          <Button size="sm" className="rounded-full gap-1.5 font-semibold">
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </Link>
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

      {/* Category filter chips */}
      <div className="flex overflow-x-auto pb-3 gap-2 px-4 sm:px-6 lg:px-8 scrollbar-hide shrink-0">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              'whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0',
              activeCategory === cat
                ? 'bg-primary text-primary-foreground'
                : 'bg-card/60 text-muted-foreground hover:bg-card hover:text-foreground border border-border/40'
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Song list */}
      <div className="flex-1 overflow-y-auto pb-24 sm:pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : displayData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted/40 flex items-center justify-center mb-5">
              <Library className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <h2 className="text-xl font-bold mb-2">
              {search || activeCategory !== 'All' ? 'No matches' : 'Collection is empty'}
            </h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              {search || activeCategory !== 'All'
                ? 'Try different search terms or clear the filter.'
                : 'Add your first song to get started.'}
            </p>
            {search || activeCategory !== 'All' ? (
              <Button variant="outline" size="sm" onClick={() => { setSearch(''); setActiveCategory('All'); }}>
                Clear filters
              </Button>
            ) : (
              <Link href="/add">
                <Button size="sm" className="rounded-full font-bold px-6">Add Song</Button>
              </Link>
            )}
          </div>
        ) : (
          <div>
            {displayData.map(({ song, topCard }, i) => (
              <Link key={song.id} href={`/song/${song.id}`}>
                <div className={cn(
                  'flex items-center gap-3.5 px-4 sm:px-6 lg:px-8 py-3 transition-colors',
                  'hover:bg-white/[0.04] active:bg-white/[0.06]',
                  i !== displayData.length - 1 && 'border-b border-border/20'
                )}>
                  {/* Album art */}
                  <AlbumArt song={song} topCard={topCard} size={56} />

                  {/* Title / artist */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[15px] leading-tight truncate text-foreground">
                      {song.title}
                    </p>
                    <p className="text-sm text-muted-foreground truncate mt-0.5 leading-tight">
                      {song.artist}
                    </p>
                  </div>

                  {/* Rarity badge */}
                  {topCard ? (
                    <RarityBadge
                      slug={topCard.rarityType.slug}
                      name={topCard.rarityType.name}
                      category={topCard.rarityType.category}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground/50 shrink-0">—</span>
                  )}

                  {/* Play button */}
                  <button
                    onClick={e => handlePlay(e, song)}
                    className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all ml-1"
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
    </div>
  );
}
