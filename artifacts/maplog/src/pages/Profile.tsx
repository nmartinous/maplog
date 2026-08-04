import React, { useMemo } from 'react';
import { useMusicKit } from '@/context/MusicKitContext';
import { Disc3, Layers, Star, TrendingUp, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

function StatCard({ label, value, icon: Icon, accent }: {
  label: string; value: string | number; icon: React.ElementType; accent?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
      <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center shrink-0', accent || 'bg-primary/10')}>
        <Icon className={cn('h-6 w-6', accent ? 'text-white' : 'text-primary')} />
      </div>
      <div>
        <p className="text-3xl font-extrabold font-mono tracking-tight">{value}</p>
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
      </div>
    </div>
  );
}

const RARITY_COLORS: Record<string, string> = {
  Radiant:           'bg-gradient-to-br from-white/20 to-slate-400/20 border-white/30',
  'Special Epic':    'bg-gradient-to-br from-rose-500/20 to-pink-500/20 border-rose-500/30',
  'Streak Epic':     'bg-gradient-to-br from-orange-500/20 to-amber-400/20 border-orange-500/30',
  Epic:              'bg-gradient-to-br from-yellow-400/20 to-amber-400/20 border-yellow-500/30',
  'Special Edition': 'bg-gradient-to-br from-pink-400/20 to-fuchsia-400/20 border-pink-500/30',
  Shiny:             'bg-gradient-to-br from-violet-500/20 to-indigo-400/20 border-violet-500/30',
  Lyric:             'bg-gradient-to-br from-sky-400/20 to-blue-400/20 border-sky-500/30',
  Moment:            'bg-gradient-to-br from-purple-500/20 to-violet-400/20 border-purple-500/30',
  Regular:           'bg-card border-border',
};

export default function Profile() {
  const { songs, isDemoMode } = useMusicKit();

  const stats = useMemo(() => {
    const totalSongs = songs.length;
    const totalCards = songs.reduce((sum, s) => sum + s.cards.length, 0);

    const byCategory = Object.entries(
      songs.flatMap(s => s.cards).reduce<Record<string, number>>((acc, card) => {
        const cat = card.rarityType.category;
        acc[cat] = (acc[cat] ?? 0) + 1;
        return acc;
      }, {}),
    )
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    const highestTier = songs.flatMap(s => s.cards).reduce((max, c) => Math.max(max, c.rarityType.tier), 0);

    return { totalSongs, totalCards, byCategory, highestTier };
  }, [songs]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-10 animate-in fade-in pb-24 sm:pb-8 max-w-4xl">

      {/* Header */}
      <div className="flex items-center gap-5">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <Disc3 className="h-10 w-10 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">My Profile</h1>
          <p className="text-muted-foreground mt-1">
            Your Soundmap collection archive{isDemoMode ? ' (demo)' : ''}
          </p>
        </div>
      </div>

      {songs.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Star className="h-12 w-12 mx-auto mb-4 opacity-40" />
          <p>No cards yet. Start adding songs to your collection!</p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Overview</h2>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <StatCard label="Songs" value={stats.totalSongs} icon={Disc3} />
              <StatCard label="Cards" value={stats.totalCards} icon={Layers} />
              <StatCard
                label="Highest Tier"
                value={stats.highestTier > 0 ? `Tier ${stats.highestTier}` : '—'}
                icon={TrendingUp}
              />
            </div>
          </section>

          {/* Cards by category */}
          {stats.byCategory.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Cards by Category</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {stats.byCategory.map(({ category, count }) => (
                  <div
                    key={category}
                    className={cn(
                      'rounded-xl border px-4 py-3 flex items-center justify-between',
                      RARITY_COLORS[category] || 'bg-card border-border',
                    )}
                  >
                    <span className="text-sm font-semibold truncate pr-2">{category}</span>
                    <span className="font-black font-mono text-lg shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Top cards */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Highest Rarity Cards</h2>
            <div className="space-y-2">
              {[...songs]
                .filter(s => s.cards.length > 0)
                .sort((a, b) => (b.cards[0]?.rarityType.tier ?? 0) - (a.cards[0]?.rarityType.tier ?? 0))
                .slice(0, 5)
                .map(song => (
                  <div key={song.id} className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3">
                    {song.artworkUrl ? (
                      <img src={song.artworkUrl} alt={song.title} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Sparkles className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
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
        </>
      )}
    </div>
  );
}
