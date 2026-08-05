import React, { useMemo } from 'react';
import { useMusicKit } from '@/context/MusicKitContext';
import { Disc3, Layers, TrendingUp, Sparkles, Star, Trophy, Target, Music2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

function StatCard({ label, value, icon: Icon, delay = 0 }: { label: string; value: string | number; icon: React.ElementType, delay?: number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', damping: 20 }}
      className="glass-panel rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden group"
    >
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-colors pointer-events-none" />
      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center shrink-0 border border-white/10 group-hover:scale-110 group-hover:bg-primary/20 group-hover:text-primary transition-all">
        <Icon className="h-6 w-6 text-white/70 group-hover:text-primary transition-colors" />
      </div>
      <div>
        <p className="text-3xl font-display font-black tracking-tight text-white mb-1">{value}</p>
        <p className="text-sm font-semibold text-white/50 uppercase tracking-wider">{label}</p>
      </div>
    </motion.div>
  );
}

const RARITY_COLORS: Record<string, string> = {
  Rare:     'bg-orange-500/10 border-orange-500/30 text-orange-400',
  Uncommon: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
  Common:   'bg-green-500/10 border-green-500/30 text-green-400',
  Regular:  'bg-white/5 border-white/10 text-white',
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
    <div className="h-full overflow-y-auto bg-background pb-20">
      <div className="px-4 sm:px-6 pt-8 pb-6 relative z-10">
        <div className="flex items-center gap-5 mb-8">
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", damping: 15 }}
            className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center shrink-0 shadow-[0_0_30px_rgba(255,60,0,0.3)] relative"
          >
            <div className="absolute inset-0 bg-white/20 rounded-[2rem] rotate-45 pointer-events-none mix-blend-overlay" />
            <Trophy className="h-10 w-10 text-white" />
          </motion.div>
          <div>
            <motion.h1 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-3xl font-display font-black tracking-tight text-white mb-1"
            >
              Collector
            </motion.h1>
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10"
            >
              <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]" />
              <span className="text-xs font-bold text-white/70 uppercase tracking-wider">
                Soundmap Archive{isDemoMode ? ' · Demo' : ''}
              </span>
            </motion.div>
          </div>
        </div>

        {songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Star className="h-16 w-16 mx-auto mb-6 text-white/10" />
            <h2 className="text-xl font-display font-bold text-white mb-2">No Stats Yet</h2>
            <p className="text-white/50 text-base max-w-xs leading-relaxed">Add cards to your collection to see your collector profile grow.</p>
          </div>
        ) : (
          <div className="space-y-10">
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Target className="w-5 h-5 text-primary" />
                <h2 className="text-sm font-bold tracking-widest uppercase text-white/80">Milestones</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <StatCard label="Total Cards" value={stats.totalCards} icon={Layers} delay={0.1} />
                <StatCard label="Unique Songs" value={stats.totalSongs} icon={Disc3} delay={0.2} />
              </div>
              <div className="mt-4">
                <StatCard label="Highest Tier Reached" value={stats.highestTier > 0 ? `Tier ${stats.highestTier}` : '—'} icon={TrendingUp} delay={0.3} />
              </div>
            </section>

            {stats.byRarity.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <h2 className="text-sm font-bold tracking-widest uppercase text-white/80">Card Distribution</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {stats.byRarity.map(({ name, count }, i) => (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 + (i * 0.05) }}
                      key={name} 
                      className={cn(
                        'rounded-2xl border px-5 py-4 flex flex-col gap-2', 
                        RARITY_COLORS[name] ?? 'bg-white/5 border-white/10 text-white'
                      )}
                    >
                      <span className="font-display font-black text-2xl">{count}</span>
                      <span className="text-xs font-bold uppercase tracking-wider opacity-80">{name}</span>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            <section className="pb-4">
              <div className="flex items-center gap-3 mb-4">
                <Star className="w-5 h-5 text-primary" />
                <h2 className="text-sm font-bold tracking-widest uppercase text-white/80">Prized Possessions</h2>
              </div>
              <div className="space-y-3">
                {[...songs]
                  .filter(s => s.cards.length > 0)
                  .sort((a, b) => (b.cards[0]?.rarityType.tier ?? 0) - (a.cards[0]?.rarityType.tier ?? 0))
                  .slice(0, 5)
                  .map((song, i) => (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + (i * 0.05) }}
                      key={song.id} 
                      className="flex items-center gap-4 glass-panel rounded-2xl p-3 hover:bg-white/10 transition-colors"
                    >
                      {song.artworkUrl
                        ? <img src={song.artworkUrl} alt={song.title} className="w-14 h-14 rounded-xl object-cover shrink-0 shadow-md" />
                        : <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/10">
                            <Music2 className="h-6 w-6 text-white/30" />
                          </div>
                      }
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <p className="font-bold text-base text-white truncate mb-0.5">{song.title}</p>
                        <p className="text-sm text-white/50 truncate">{song.artist}</p>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        <span className={cn(
                          "text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full border",
                          RARITY_COLORS[song.cards[0]?.rarityType.name] ?? "bg-primary/20 text-primary border-primary/30"
                        )}>
                          {song.cards[0]?.rarityType.name}
                        </span>
                      </div>
                    </motion.div>
                  ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
