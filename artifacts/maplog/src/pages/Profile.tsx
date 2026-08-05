import React, { useMemo } from 'react';
import { useMusicKit } from '@/context/MusicKitContext';
import { Disc3, Layers, TrendingUp, Sparkles, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ElementType }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3.5">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <p className="text-2xl font-extrabold font-mono tracking-tight leading-none">{value}</p>
        <p className="text-xs text-muted-foreground font-medium mt-0.5">{label}</p>
      </div>
    </div>
  );
}

const RARITY_COLORS: Record<string, string> = {
  Rare:     'bg-orange-500/10 border-orange-500/20',
  Uncommon: 'bg-green-500/10 border-green-500/20',
  Common:   'bg-card border-border',
  Regular:  'bg-card border-border',
};

export default function Profile() {
  const { songs, isDemoMode } = useMusicKit();

  const stats = useMemo(() => {
    const totalSongs = songs.length;
    const totalCards = songs.reduce((sum, s) => sum + s.cards.length, 0);
    const byRarity = Object.entries(
      songs.flatMap(s => s.cards).reduce<Record<string, number>>((acc, card) => {
        const n = card.rarityType.name;
        acc[n] = (acc[n] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    const highestTier = songs.flatMap(s => s.cards).reduce((max, c) => Math.max(max, c.rarityType.tier), 0);
    return { totalSongs, totalCards, byRarity, highestTier };
  }, [songs]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 sm:px-6 pt-5 pb-4">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Disc3 className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">My Profile</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Soundmap archive{isDemoMode ? ' · demo' : ''}
            </p>
          </div>
        </div>

        {songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Star className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-muted-foreground text-sm">No cards yet. Start adding songs!</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Overview stats */}
            <section className="space-y-3">
              <h2 className="text-[10px] font-black tracking-widest uppercase text-muted-foreground">Overview</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatCard label="Songs"       value={stats.totalSongs} icon={Disc3} />
                <StatCard label="Cards"       value={stats.totalCards} icon={Layers} />
                <StatCard label="Highest Tier" value={stats.highestTier > 0 ? `Tier ${stats.highestTier}` : '—'} icon={TrendingUp} />
              </div>
            </section>

            {/* By rarity */}
            {stats.byRarity.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-[10px] font-black tracking-widest uppercase text-muted-foreground">Cards by Rarity</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {stats.byRarity.map(({ name, count }) => (
                    <div key={name} className={cn('rounded-xl border px-4 py-3 flex items-center justify-between', RARITY_COLORS[name] ?? 'bg-card border-border')}>
                      <span className="text-sm font-semibold truncate pr-2">{name}</span>
                      <span className="font-black font-mono text-lg shrink-0">{count}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Top cards */}
            <section className="space-y-3 pb-6">
              <h2 className="text-[10px] font-black tracking-widest uppercase text-muted-foreground">Highest Rarity Cards</h2>
              <div className="space-y-2">
                {[...songs]
                  .filter(s => s.cards.length > 0)
                  .sort((a, b) => (b.cards[0]?.rarityType.tier ?? 0) - (a.cards[0]?.rarityType.tier ?? 0))
                  .slice(0, 5)
                  .map(song => (
                    <div key={song.id} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
                      {song.artworkUrl
                        ? <img src={song.artworkUrl} alt={song.title} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                        : <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <Sparkles className="h-5 w-5 text-muted-foreground" />
                          </div>
                      }
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{song.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                      </div>
                      <span className="text-xs font-bold text-primary/70 bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20 shrink-0">
                        {song.cards[0]?.rarityType.name}
                      </span>
                    </div>
                  ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
