import React, { useEffect, useState } from 'react';
import { usePlayer } from '@/context/AudioPlayerContext';
import { Link } from 'wouter';
import useEmblaCarousel from 'embla-carousel-react';
import { Library, ListMusic, ListOrdered, Volume2, X } from 'lucide-react';
import { SoundmapCard } from '@/components/SoundmapCard';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function Home() {
  const { currentSong, isPlaying, activeCardIndex, setActiveCardIndex, queue } = usePlayer();
  const [isQueueOpen, setIsQueueOpen] = useState(false);

  const cards = currentSong?.cards ?? [];
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, startIndex: activeCardIndex });

  useEffect(() => {
    if (emblaApi) emblaApi.on('select', () => setActiveCardIndex(emblaApi.selectedScrollSnap()));
  }, [emblaApi, setActiveCardIndex]);

  useEffect(() => {
    if (emblaApi && activeCardIndex !== emblaApi.selectedScrollSnap()) emblaApi.scrollTo(activeCardIndex);
  }, [emblaApi, activeCardIndex]);

  if (!currentSong) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        className="h-full flex flex-col items-center justify-center p-6 text-center relative z-10"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none -z-10" />
        
        <div className="relative">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 w-32 h-32 bg-primary/20 blur-3xl rounded-full"
          />
          <div className="w-24 h-24 rounded-[2rem] glass-panel flex items-center justify-center mb-8 relative z-10 shadow-2xl">
            <ListMusic className="w-10 h-10 text-white/50" />
          </div>
        </div>
        
        <h1 className="text-3xl font-display font-bold mb-3 text-white">Your Music Binder</h1>
        <p className="text-muted-foreground text-sm mb-10 max-w-sm leading-relaxed">
          Select a song from your collection to start listening and view your prized cards.
        </p>
        <Link href="/collection">
          <Button size="lg" className="rounded-full font-bold px-8 gap-2 h-12 shadow-primary/25 shadow-xl hover:scale-105 transition-transform">
            <Library className="h-5 w-5" />
            Browse Collection
          </Button>
        </Link>
      </motion.div>
    );
  }

  return (
    <div className="h-full bg-background text-white flex flex-col overflow-hidden relative">
      <AnimatePresence>
        <motion.div 
          key={cards[activeCardIndex]?.artworkUrl ?? currentSong.artworkUrl ?? 'bg'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          className="absolute inset-0 z-0 pointer-events-none overflow-hidden"
        >
          {(cards[activeCardIndex]?.artworkUrl ?? currentSong.artworkUrl) ? (
            <img
              src={cards[activeCardIndex]?.artworkUrl ?? currentSong.artworkUrl!}
              alt=""
              className="w-full h-full object-cover blur-[100px] scale-125 transform-gpu"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/30 to-secondary/30 blur-3xl" />
          )}
        </motion.div>
      </AnimatePresence>
      <div className="absolute inset-0 bg-background/60 z-0" />

      <div className="relative z-10 flex items-center justify-between px-5 pt-8 pb-4 shrink-0">
        <Button variant="ghost" size="icon"
          className="w-10 h-10 rounded-full glass-panel hover:bg-white/10 transition-colors" asChild>
          <Link href="/collection">
            <Library className="h-5 w-5 text-white/80" />
          </Link>
        </Button>
        <div className="flex flex-col items-center">
          <span className="text-[9px] font-black tracking-[0.25em] uppercase text-primary mb-1">Now Playing</span>
          <span className="text-sm font-semibold truncate max-w-[150px] text-white/90">{currentSong.title}</span>
        </div>
        <Button variant="ghost" size="icon"
          className="w-10 h-10 rounded-full glass-panel hover:bg-white/10 transition-colors"
          onClick={() => setIsQueueOpen(true)}>
          <ListOrdered className="h-5 w-5 text-white/80" />
        </Button>
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full max-w-[100vw] mx-auto min-h-0 px-2">
        {cards.length > 0 ? (
          <>
            <div className="w-full [overflow-x:clip] py-6 px-10" ref={emblaRef}>
              <div className="flex touch-pan-y items-center">
                {cards.map((card, i) => (
                  <div key={card.id} className="flex-[0_0_100%] min-w-0 flex justify-center items-center perspective-[1000px]">
                    <motion.div
                      animate={{ 
                        scale: i === activeCardIndex ? 1 : 0.85,
                        opacity: i === activeCardIndex ? 1 : 0.4,
                        rotateY: i === activeCardIndex ? 0 : (i < activeCardIndex ? 15 : -15),
                        z: i === activeCardIndex ? 0 : -100
                      }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      className="transform-style-3d"
                    >
                      <SoundmapCard
                        card={card}
                        title={currentSong.title}
                        artist={currentSong.artist}
                        genre={currentSong.genre}
                        size="hero"
                      />
                    </motion.div>
                  </div>
                ))}
              </div>
            </div>
            {cards.length > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4 shrink-0 bg-black/20 backdrop-blur-xl px-4 py-2 rounded-full border border-white/5">
                {cards.map((_, i) => (
                  <button 
                    key={i}
                    onClick={() => emblaApi?.scrollTo(i)}
                    className="group py-2"
                  >
                    <div
                      className={cn(
                        'h-1.5 rounded-full transition-all duration-300',
                        i === activeCardIndex ? 'w-6 bg-primary shadow-[0_0_10px_rgba(255,60,0,0.5)]' : 'w-1.5 bg-white/20 group-hover:bg-white/40 group-hover:w-3',
                      )}
                    />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-[280px] aspect-[2/3] rounded-[2rem] glass-panel flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
              <ListMusic className="w-8 h-8 text-white/30" />
            </div>
            <p className="font-display font-bold text-xl mb-1">{currentSong.title}</p>
            <p className="text-white/50 text-sm mb-6">{currentSong.artist}</p>
            <div className="px-4 py-1.5 rounded-full bg-white/5 text-[10px] font-bold uppercase tracking-widest text-white/50 border border-white/10">
              No Cards Collected
            </div>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {isQueueOpen && (
          <motion.div 
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute inset-0 z-50 bg-background/95 backdrop-blur-3xl flex flex-col"
          >
            <div className="flex justify-between items-center px-6 pt-12 pb-4 shrink-0 border-b border-white/5">
              <div>
                <h3 className="text-2xl font-display font-bold text-white">Up Next</h3>
                <p className="text-primary font-medium text-sm mt-0.5">
                  {queue.length} song{queue.length !== 1 ? 's' : ''} in queue
                </p>
              </div>
              <Button variant="ghost" size="icon"
                className="rounded-full bg-white/5 hover:bg-white/10 text-white"
                onClick={() => setIsQueueOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
              {queue.length === 0 ? (
                <div className="text-center py-24 flex flex-col items-center">
                  <ListOrdered className="w-12 h-12 text-white/10 mb-4" />
                  <p className="text-white/40 text-sm font-medium">Your queue is empty</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {queue.map((song, i) => {
                    const isCurrent = song.id === currentSong.id;
                    return (
                      <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        key={`${song.id}-${i}`}
                        className={cn(
                          'flex items-center gap-4 px-3 py-3 rounded-2xl transition-colors',
                          isCurrent ? 'bg-primary/10 border border-primary/20' : 'hover:bg-white/5',
                        )}>
                        <div className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner',
                          isCurrent ? 'bg-primary text-white' : 'bg-white/5 text-white/40',
                        )}>
                          {isCurrent ? <Volume2 className="h-5 w-5" /> : <span className="text-sm font-bold">{i + 1}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-[15px] font-bold truncate leading-tight', isCurrent ? 'text-white' : 'text-white/80')}>
                            {song.title}
                          </p>
                          <p className="text-xs text-white/50 truncate mt-0.5">{song.artist}</p>
                        </div>
                        {isCurrent && isPlaying && (
                          <div className="shrink-0 flex items-end gap-[3px] h-4">
                            {[0, 1, 2, 3].map(j => (
                              <div key={j}
                                className="w-1 bg-primary rounded-full animate-[bounce_0.8s_ease-in-out_infinite]"
                                style={{ height: `${8 + j * 3}px`, animationDelay: `${j * 0.15}s` }}
                              />
                            ))}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
