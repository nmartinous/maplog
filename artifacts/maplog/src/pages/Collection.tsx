import React, { useState, useMemo } from 'react';
import { useListSongs, useListCollectedCards, Song, CollectedCard } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { SoundmapCard } from '@/components/SoundmapCard';
import { Input } from '@/components/ui/input';
import { Search, SlidersHorizontal, Loader2, Library } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const CATEGORIES = ['All', 'Regular', 'Shiny', 'Epic', 'Special Edition', 'Lyric', 'Radiant', 'Moment'];

export default function Collection() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  // For a real app, pagination/infinite scroll would be used.
  const { data: songs, isLoading: isLoadingSongs } = useListSongs({ limit: 1000 });
  const { data: allCards, isLoading: isLoadingCards } = useListCollectedCards({ limit: 5000 });

  const displayData = useMemo(() => {
    if (!songs || !allCards) return [];

    // Group cards by song ID
    const cardsBySongId = new Map<number, CollectedCard[]>();
    for (const card of allCards) {
      if (!cardsBySongId.has(card.songId)) {
        cardsBySongId.set(card.songId, []);
      }
      cardsBySongId.get(card.songId)!.push(card);
    }

    let filtered = songs.filter(song => {
      if (search) {
        const query = search.toLowerCase();
        if (!song.title.toLowerCase().includes(query) && !song.artist.toLowerCase().includes(query)) {
          return false;
        }
      }
      return true;
    });

    // Map each song to its highest rarity card
    const items = filtered.map(song => {
      const songCards = cardsBySongId.get(song.id) || [];
      // Sort by tier descending
      songCards.sort((a, b) => b.rarityType.tier - a.rarityType.tier);
      const topCard = songCards[0]; // highest tier or undefined
      return { song, topCard, cards: songCards };
    });

    // Filter by category if needed
    if (activeCategory !== 'All') {
      return items.filter(item => {
        // If a song has ANY card matching the category, keep it? Or if topCard matches?
        // Let's say if ANY card matches the category
        return item.cards.some(c => c.rarityType.category === activeCategory);
      });
    }

    return items;
  }, [songs, allCards, search, activeCategory]);

  const isLoading = isLoadingSongs || isLoadingCards;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 animate-in fade-in pb-24 sm:pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Collection</h1>
          <p className="text-muted-foreground mt-1">
            {displayData.length} {displayData.length === 1 ? 'song' : 'songs'} collected
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input 
            placeholder="Search by title or artist..." 
            className="pl-10 h-12 bg-card/50 border-border/50 text-base"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 gap-2 scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold transition-all",
                activeCategory === cat 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-card/50 text-muted-foreground hover:bg-card hover:text-foreground border border-border/50"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : displayData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-6">
            <Library className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold mb-2">No songs found</h2>
          <p className="text-muted-foreground max-w-md mb-8">
            {search || activeCategory !== 'All' 
              ? "No songs match your current filters. Try clearing your search or changing the category."
              : "Your collection is empty. Start adding your favorite songs and their rarity cards!"}
          </p>
          {(search || activeCategory !== 'All') ? (
            <Button onClick={() => { setSearch(''); setActiveCategory('All'); }}>
              Clear Filters
            </Button>
          ) : (
            <Link href="/add">
              <Button size="lg" className="rounded-full font-bold">
                Add Your First Song
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
          {displayData.map(({ song, topCard }) => (
            <Link key={song.id} href={`/song/${song.id}`}>
              <div className="group cursor-pointer">
                {topCard ? (
                  <SoundmapCard 
                    card={topCard} 
                    title={song.title} 
                    artist={song.artist} 
                    className="w-full h-auto aspect-[2/3] transform transition-transform duration-300 group-hover:-translate-y-2 group-hover:shadow-2xl" 
                  />
                ) : (
                  <div className="w-full aspect-[2/3] rounded-lg bg-card border-2 border-dashed border-border flex flex-col items-center justify-center p-4 text-center transform transition-transform duration-300 group-hover:-translate-y-2">
                    <span className="text-xs text-muted-foreground font-bold tracking-widest uppercase mb-2">No Cards</span>
                    <h3 className="font-bold text-sm line-clamp-2">{song.title}</h3>
                    <p className="text-xs text-muted-foreground truncate w-full">{song.artist}</p>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
