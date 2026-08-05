import React, { useEffect, useState } from 'react';
import { usePlayer } from '@/context/AudioPlayerContext';
import { Link } from 'wouter';
import useEmblaCarousel from 'embla-carousel-react';
import { Library, ListOrdered, Volume2, X, Info, Music2 } from 'lucide-react';
import { SoundmapCard } from '@/components/SoundmapCard';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import type { MaplogSong } from '@/lib/types';

function CardBackInfo({ trackId, song }: { trackId: string, song: MaplogSong }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['deezer-track', trackId],
    queryFn: async () => {
      const res = await fetch(`/api/deezer/track/${trackId}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    staleTime: 1000 * 60 * 60,
  });

  return (
    <div className="w-full h-full flex flex-col p-6 items-center justify-center text-center gap-4 relative">
       {/* Background subtle art */}
       <div className="absolute inset-0 opacity-20 bg-cover bg-center blur-2xl scale-125" style={{ backgroundImage: `url(${song.artworkUrl})` }} />
       <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/80 to-black/95" />
       
       <div className="relative z-10 w-full flex flex-col items-center h-full justify-center">
         <h3 className="font-display font-black text-2xl sm:text-3xl mb-1 text-white truncate w-full px-2">{song.title}</h3>
         <p className="text-primary font-bold text-sm sm:text-base mb-8 truncate w-full">{song.artist}</p>
         
         {isLoading ? (
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin my-auto" />
         ) : error ? (
            <p className="text-xs text-white/50 my-auto">Details unavailable</p>
         ) : data ? (
            <div className="grid grid-cols-2 gap-y-6 gap-x-4 w-full px-4 text-left">
               <div className="flex flex-col">
                 <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1">Album</span>
                 <span className="text-xs sm:text-sm font-semibold text-white/90 truncate leading-tight">{data.album?.title || 'Single'}</span>
               </div>
               <div className="flex flex-col">
                 <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1">Released</span>
                 <span className="text-xs sm:text-sm font-semibold text-white/90">{data.release_date || 'Unknown'}</span>
               </div>
               <div className="flex flex-col">
                 <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1">Duration</span>
                 <span className="text-xs sm:text-sm font-semibold text-white/90">
                   {data.duration ? `${Math.floor(data.duration / 60)}:${String(data.duration % 60).padStart(2, '0')}` : '0:00'}
                 </span>
               </div>
               <div className="flex flex-col">
                 <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1">BPM</span>
                 <span className="text-xs sm:text-sm font-semibold text-white/90">{data.bpm ? Math.round(data.bpm) : '--'}</span>
               </div>
               {song.genre && (
                 <div className="flex flex-col col-span-2">
                   <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1">Genre</span>
                   <span className="text-xs sm:text-sm font-semibold text-white/90 truncate">{song.genre}</span>
                 </div>
               )}
            </div>
         ) : null}
       </div>
    </div>
  );
}

export default function Home() {
  const { currentSong, isPlaying, activeCardIndex, setActiveCardIndex, queue } = usePlayer();
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);

  const cards = currentSong?.cards ?? [];
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, startIndex: activeCardIndex });

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setActiveCardIndex(emblaApi.selectedScrollSnap());
    emblaApi.on('select', onSelect);
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi, setActiveCardIndex]);

  useEffect(() => {
    if (emblaApi && activeCardIndex !== emblaApi.selectedScrollSnap()) emblaApi.scrollTo(activeCardIndex);
  }, [emblaApi, activeCardIndex]);

  useEffect(() => {
    setIsFlipped(false);
  }, [activeCardIndex, currentSong?.id]);

  if (!currentSong) {
    return (
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
        className="h-full w-full flex flex-col items-center justify-center p-6 text-center relative z-10 overflow-hidden bg-background"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none -z-10" />
        
        <motion.div 
          animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute top-[10%] left-[10%] w-[40%] h-[40%] bg-primary/20 blur-[100px] rounded-full pointer-events-none -z-10"
        />
        <motion.div 
          animate={{ scale: [1, 1.5, 1], rotate: [0, -90, 0] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[20%] right-[10%] w-[50%] h-[50%] bg-orange-600/10 blur-[100px] rounded-full pointer-events-none -z-10"
        />
        
        <motion.div 
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.6, ease: "easeOut" }}
           className="relative flex flex-col items-center w-full max-w-sm"
        >
          <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-[2.5rem] glass-panel flex items-center justify-center mb-8 relative z-10 shadow-2xl border-white/10 overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <Music2 className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-black mb-4 text-white tracking-tight">Music Binder</h1>
          <p className="text-white/50 text-sm sm:text-base mb-10 leading-relaxed font-medium">
            Your collection is waiting. Select a track to start playback and reveal your cards.
          </p>
          <Link href="/collection">
            <Button size="lg" className="rounded-full font-bold px-8 h-14 shadow-[0_0_40px_-10px_rgba(255,60,0,0.5)] hover:shadow-[0_0_60px_-10px_rgba(255,60,0,0.7)] hover:scale-105 active:scale-95 transition-all text-base bg-primary text-white flex items-center gap-3">
              <Library className="h-5 w-5" />
              Open Collection
            </Button>
          </Link>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
      className="h-full bg-background text-white flex flex-col overflow-hidden relative w-full"
    >
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
      <div className="absolute inset-0 bg-background/60 z-0 pointer-events-none" />

      <div className="relative z-50 flex items-center justify-between px-5 pt-8 pb-4 shrink-0 pointer-events-auto">
        <Button variant="ghost" size="icon"
          className={cn(
            "w-11 h-11 rounded-full glass-panel transition-colors shadow-lg active:scale-95",
            isFlipped ? "bg-white/20 text-primary border-primary/50" : "hover:bg-white/10 text-white/80"
          )}
          onClick={() => setIsFlipped(f => !f)}>
          <Info className="h-5 w-5" />
        </Button>
        <div className="flex flex-col items-center">
          <span className="text-[9px] font-black tracking-[0.25em] uppercase text-primary mb-1">Now Playing</span>
          <span className="text-sm font-semibold truncate max-w-[150px] text-white/90">{currentSong.title}</span>
        </div>
        <Button variant="ghost" size="icon"
          className="w-11 h-11 rounded-full glass-panel hover:bg-white/10 transition-colors active:scale-95 shadow-lg"
          onClick={() => setIsQueueOpen(true)}>
          <ListOrdered className="h-5 w-5 text-white/80" />
        </Button>
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full max-w-[100vw] mx-auto min-h-0 px-2 pb-6">
        {cards.length > 0 ? (
          <>
            <div className="w-full overflow-visible py-4 px-4 sm:px-10 flex-1 flex flex-col justify-center" ref={emblaRef}>
              <div className="flex touch-pan-y items-center overflow-visible">
                {cards.map((card, i) => (
                  <div key={card.id} className="flex-[0_0_100%] min-w-0 flex justify-center items-center perspective-[1000px]">
                    <motion.div
                      animate={{ 
                        scale: i === activeCardIndex ? (isFlipped ? 1.05 : 1) : 0.85,
                        opacity: i === activeCardIndex ? 1 : 0.4,
                        rotateX: isFlipped && i === activeCardIndex ? 180 : 0,
                        rotateY: i === activeCardIndex ? 0 : (i < activeCardIndex ? 15 : -15),
                        y: isFlipped && i === activeCardIndex ? -15 : 0,
                        z: i === activeCardIndex ? (isFlipped ? 50 : 0) : -100
                      }}
                      transition={{ type: "spring", stiffness: 260, damping: 25 }}
                      className="relative"
                      style={{ transformStyle: 'preserve-3d', zIndex: i === activeCardIndex ? 50 : 0, touchAction: 'pan-x' }}
                      onPanEnd={(e, info) => {
                        if (i !== activeCardIndex) return;
                        // Vertical swipe (up or down) toggles the flip; ignore mostly-horizontal
                        // pans so the embla carousel keeps card-to-card swiping.
                        if (Math.abs(info.offset.y) <= Math.abs(info.offset.x)) return;
                        if (Math.abs(info.offset.y) > 40 || Math.abs(info.velocity.y) > 200) {
                          setIsFlipped(f => !f);
                        }
                      }}
                    >
                      <div style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
                        <SoundmapCard
                          card={card}
                          title={currentSong.title}
                          artist={currentSong.artist}
                          genre={currentSong.genre}
                          size="hero"
                          className="shadow-2xl"
                        />
                      </div>
                      <div 
                        className="absolute inset-0 rounded-[1.5rem] sm:rounded-[2rem] glass-panel bg-card/95 backdrop-blur-xl border border-white/20 shadow-2xl overflow-hidden pointer-events-none"
                        style={{ 
                          backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                          transform: 'rotateX(180deg)' 
                        }}
                      >
                        <CardBackInfo trackId={currentSong.id} song={currentSong} />
                      </div>
                    </motion.div>
                  </div>
                ))}
              </div>
            </div>
            {cards.length > 1 && (
              <div className="flex items-center justify-center gap-2 mt-2 shrink-0 bg-black/20 backdrop-blur-xl px-4 py-2 rounded-full border border-white/5">
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
          <div className="flex flex-col items-center justify-center h-full">
             {/* Fallback if somehow currentSong exists but cards is empty */}
          </div>
        )}
      </div>

      <AnimatePresence>
        {isQueueOpen && (
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0, transition: { type: "spring", damping: 30, stiffness: 300 } }}
            exit={{ y: "100%", transition: { duration: 0.25, ease: [0.4, 0, 1, 1] } }}
            className="absolute inset-0 z-50 bg-background flex flex-col will-change-transform"
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
    </motion.div>
  );
}