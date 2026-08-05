import React, { useMemo } from 'react';
import { Link } from 'wouter';
import { useMusicKit } from '@/context/MusicKitContext';
import { DEMO_RARITIES } from '@/lib/rarityMap';
import { RarityBadge } from '@/components/RarityBadge';
import { Music2, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Group songs by rarity name for a "browse by rarity" view */
export default function Playlists() {
  const { songs } = useMusicKit();

  const groups = useMemo(() =>
    DEMO_RARITIES
      .map(rarity => {
        const matching = songs.filter(s =>
          s.cards.some(c => c.rarityType.name === rarity.name),
        );
        const cardCount = songs
          .flatMap(s => s.cards)
          .filter(c => c.rarityType.name === rarity.name).length;
        return { rarity, songs: matching, cardCount };
      })
      .filter(g => g.songs.length > 0),
    [songs],
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 pb-nav sm:pb-8">
      <div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">By Rarity</h1>
        <p className="text-muted-foreground mt-1">Your collection grouped by card tier</p>
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
          {groups.map(({ rarity, songs: groupSongs, cardCount }) => (
            <Link key={rarity.slug} href="/collection">
              <div className="group bg-card hover:bg-accent border border-border rounded-2xl p-5 transition-all cursor-pointer active:scale-[0.98]">

                {/* Top 3 artworks stacked */}
                <div className="flex gap-1.5 mb-4 h-14 items-end">
                  {groupSongs.slice(0, 3).map((song, i) => (
                    <div
                      key={song.id}
                      className={cn(
                        'rounded-xl overflow-hidden shrink-0 transition-all',
                        i === 0 ? 'w-14 h-14' : 'w-10 h-10 opacity-60',
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
                      {rarity.name}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {groupSongs.length} {groupSongs.length === 1 ? 'song' : 'songs'}
                      {' · '}
                      {cardCount} {cardCount === 1 ? 'card' : 'cards'}
                    </p>
                  </div>
                  <RarityBadge slug={rarity.slug} name={rarity.name} category={rarity.category} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
