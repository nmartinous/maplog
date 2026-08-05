import React, { useMemo } from 'react';
import { Link } from 'wouter';
import { useMusicKit } from '@/context/MusicKitContext';
import { DEMO_RARITIES } from '@/lib/rarityMap';
import { RarityBadge } from '@/components/RarityBadge';
import { Music2, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export default function Playlists() {
  const { songs } = useMusicKit();

  const groups = useMemo(() =>
    DEMO_RARITIES
      .map(rarity => {
        const matching = songs.filter(s => s.cards.some(c => c.rarityType.name === rarity.name));
        const cardCount = songs.flatMap(s => s.cards).filter(c => c.rarityType.name === rarity.name).length;
        return { rarity, songs: matching, cardCount };
      })
      .filter(g => g.songs.length > 0),
    [songs],
  );

  return (
    <div className="h-full overflow-y-auto bg-background pb-20">
      <div className="px-4 sm:px-6 pt-8 pb-6 relative z-10">
        <h1 className="text-3xl font-display font-black tracking-tight text-white">Binders</h1>
        <p className="text-sm text-white/50 mt-1">Your collection grouped by rarity tiers</p>
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-8 text-center"
          style={{ height: 'calc(100% - 120px)' }}>
          <div className="w-24 h-24 rounded-[2rem] glass-panel flex items-center justify-center mb-6">
            <Layers className="w-10 h-10 text-white/30" />
          </div>
          <h2 className="text-2xl font-display font-bold mb-2 text-white">No binders yet</h2>
          <p className="text-base text-white/50 max-w-[260px] leading-relaxed">
            Add songs to your collection and they'll automatically organize into rarity binders here.
          </p>
        </div>
      ) : (
        <div className="px-4 sm:px-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {groups.map(({ rarity, songs: groupSongs, cardCount }, index) => (
            <motion.div
              key={rarity.slug}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, type: 'spring', damping: 20 }}
            >
              <Link href="/collection">
                <div className="group glass-panel rounded-[2rem] p-5 transition-all cursor-pointer hover:bg-white/10 hover:border-white/20 active:scale-[0.98] overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[40px] -mr-10 -mt-10 group-hover:bg-primary/20 transition-colors pointer-events-none" />
                  
                  <div className="flex items-center justify-between mb-6 relative z-10">
                    <RarityBadge slug={rarity.slug} name={rarity.name} category={rarity.category} size="md" />
                    <div className="text-right">
                      <p className="font-bold text-white text-lg">{cardCount}</p>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">Cards</p>
                    </div>
                  </div>

                  <div className="flex gap-2 h-20 items-end relative z-10">
                    {groupSongs.slice(0, 4).map((song, i) => (
                      <div key={song.id}
                        className={cn(
                          'rounded-2xl overflow-hidden shrink-0 shadow-lg border border-white/10 transition-transform duration-500 group-hover:-translate-y-2',
                          i === 0 ? 'w-20 h-20 z-40' : 
                          i === 1 ? 'w-16 h-16 z-30 -ml-6 opacity-90' : 
                          i === 2 ? 'w-12 h-12 z-20 -ml-6 opacity-70' : 
                          'w-8 h-8 z-10 -ml-4 opacity-50'
                        )}
                        style={{ transitionDelay: `${i * 50}ms` }}
                      >
                        {song.artworkUrl
                          ? <img src={song.artworkUrl} alt={song.title} className="w-full h-full object-cover" />
                          : <div className="w-full h-full bg-white/5 flex items-center justify-center">
                              <Music2 className="w-4 h-4 text-white/30" />
                            </div>
                        }
                      </div>
                    ))}
                    {groupSongs.length > 4 && (
                      <div className="w-8 h-8 rounded-full bg-white/10 border border-white/5 flex items-center justify-center text-xs font-bold text-white/70 -ml-3 z-0 mb-2">
                        +{groupSongs.length - 4}
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-6 flex items-center justify-between relative z-10">
                    <p className="font-display font-bold text-xl text-white group-hover:text-primary transition-colors">
                      {rarity.name} Binder
                    </p>
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
