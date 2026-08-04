import React, { useMemo } from 'react';
import { Link } from 'wouter';
import { useMusicKit } from '@/context/MusicKitContext';
import { ALL_CATEGORIES } from '@/lib/rarityMap';
import { RarityBadge } from '@/components/RarityBadge';
import { Music2, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Group songs by rarity category for a "browse by rarity" view */
export default function Playlists() {
  const { songs } = useMusicKit();

  const groups = useMemo(() => {
    const cats = ALL_CATEGORIES.filter(c => c !== 'All');
    return cats
      .map(category => {
        const matching = songs.filter(s =>
          s.cards.some(c => c.rarityType.category === category),
        );
        const cardCount = songs
          .flatMap(s => s.cards)
          .filter(c => c.rarityType.category === category).length;
        // representative card for the top artwork
        const topCard = matching
          .flatMap(s => s.cards)
          .filter(c => c.rarityType.category === category)
          .sort((a, b) => b.rarityType.tier - a.rarityType.tier)[0];
        return { category, songs: matching, cardCount, topCard };
      })
      .filter(g => g.songs.length > 0);
  }, [songs]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-in fade-in pb-24 sm:pb-8">
      <div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">By Rarity</h1>
        <p className="text-muted-foreground mt-1">Your collection grouped by card type</p>
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center px-8">
          <div className="w-16 h-16 rounded-2xl bg-muted/40 flex items-center justify-center mb-5">
            <Layers className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <h2 className="text-xl font-bold mb-2">No cards yet</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            Add songs to your collection and they'll appear here grouped by rarity.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map(({ category, songs: groupSongs, cardCount, topCard }) => (
            <Link key={category} href={`/collection`}>
              <div className="group bg-card hover:bg-accent border border-border rounded-2xl p-5 transition-all cursor-pointer">

                {/* Top 3 artworks stacked */}
                <div className="flex gap-1.5 mb-4 h-14">
                  {groupSongs.slice(0, 3).map((song, i) => (
                    <div
                      key={song.id}
                      className={cn(
                        'rounded-xl overflow-hidden shrink-0 transition-all',
                        i === 0 ? 'w-14 h-14' : 'w-10 h-10 mt-2 opacity-60',
                      )}
                    >
                      {song.artworkUrl ? (
                        <img src={song.artworkUrl} alt={song.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <Music2 className="w-4 h-4 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-extrabold text-base truncate group-hover:text-primary transition-colors">
                      {category}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {groupSongs.length} {groupSongs.length === 1 ? 'song' : 'songs'}
                      {' · '}
                      {cardCount} {cardCount === 1 ? 'card' : 'cards'}
                    </p>
                  </div>
                  {topCard && (
                    <RarityBadge
                      slug={topCard.rarityType.slug}
                      name={topCard.rarityType.name}
                      category={topCard.rarityType.category}
                    />
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
