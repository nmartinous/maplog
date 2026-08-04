import React from 'react';
import { useGetStats } from '@workspace/api-client-react';
import { Disc3, Star, Layers, ListMusic, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: string | number; icon: React.ElementType; accent?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4 card-effect">
      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", accent || "bg-primary/10")}>
        <Icon className={cn("h-6 w-6", accent ? "text-white" : "text-primary")} />
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
  const { data: stats, isLoading } = useGetStats();

  // Find highest tier card in byCategory (tier is on each stat)
  const highestTier = stats?.byCategory?.length
    ? Math.max(...stats.byCategory.map(c => c.tier))
    : null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-10 animate-in fade-in pb-24 sm:pb-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-5">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <Disc3 className="h-10 w-10 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">My Profile</h1>
          <p className="text-muted-foreground mt-1">Your Soundmap collection archive</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 h-24 animate-pulse" />
          ))}
        </div>
      ) : stats ? (
        <>
          {/* Primary Stats */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Overview</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Songs" value={stats.totalSongs} icon={Disc3} />
              <StatCard label="Cards" value={stats.totalCards} icon={Layers} />
              <StatCard label="Playlists" value={stats.totalPlaylists ?? 0} icon={ListMusic} />
              <StatCard label="Highest Tier" value={highestTier != null ? `Tier ${highestTier}` : '—'} icon={TrendingUp} />
            </div>
          </section>

          {/* Cards by Category */}
          {stats.byCategory.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Cards by Category</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {[...stats.byCategory]
                  .sort((a, b) => b.count - a.count)
                  .map(stat => (
                    <div
                      key={stat.category}
                      className={cn(
                        "rounded-xl border px-4 py-3 flex items-center justify-between",
                        RARITY_COLORS[stat.category] || 'bg-card border-border'
                      )}
                    >
                      <span className="text-sm font-semibold truncate pr-2">{stat.category}</span>
                      <span className="font-black font-mono text-lg shrink-0">{stat.count}</span>
                    </div>
                  ))}
              </div>
            </section>
          )}

          {/* Recently Added */}
          {stats.recentlyAdded.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Recently Added</h2>
              <div className="space-y-2">
                {stats.recentlyAdded.map(song => (
                  <div key={song.id} className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3">
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Disc3 className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{song.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono shrink-0">
                      {new Date(song.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <div className="text-center py-20 text-muted-foreground">
          <Star className="h-12 w-12 mx-auto mb-4 opacity-40" />
          <p>No stats yet. Start building your collection!</p>
        </div>
      )}
    </div>
  );
}
