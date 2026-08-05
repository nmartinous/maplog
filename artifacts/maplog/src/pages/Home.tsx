import React, { useEffect, useState } from 'react';
import { usePlayer } from '@/context/AudioPlayerContext';
import { Link } from 'wouter';
import useEmblaCarousel from 'embla-carousel-react';
import { Library, ListMusic, ListOrdered, Volume2 } from 'lucide-react';
import { SoundmapCard } from '@/components/SoundmapCard';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!currentSong) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 rounded-3xl bg-muted/40 border border-border flex items-center justify-center mb-6">
          <ListMusic className="w-10 h-10 text-muted-foreground/50" />
        </div>
        <h1 className="text-2xl font-bold mb-2">No song playing</h1>
        <p className="text-muted-foreground text-sm mb-8 max-w-xs">
          Select a song from your collection to start listening.
        </p>
        <Link href="/collection">
          <Button size="lg" className="rounded-full font-bold px-8 gap-2">
            <Library className="h-5 w-5" />
            Go to Collection
          </Button>
        </Link>
      </div>
    );
  }

  return (
    // h-full fills the motion.div which fills .app-main exactly — no chrome overlap
    <div className="h-full bg-black text-white flex flex-col overflow-hidden relative">

      {/* Ambient art background */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {(cards[activeCardIndex]?.artworkUrl ?? currentSong.artworkUrl) ? (
          <img
            src={cards[activeCardIndex]?.artworkUrl ?? currentSong.artworkUrl!}
            alt=""
            className="w-full h-full object-cover blur-3xl scale-150 opacity-30 transform-gpu"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 blur-3xl" />
        )}
        <div className="absolute inset-0 bg-black/55" />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-8 landscape-compact:pt-2 pb-2 shrink-0">
        <Button variant="ghost" size="icon"
          className="w-9 h-9 rounded-full text-white/50 hover:text-white hover:bg-white/10" asChild>
          <Link href="/collection">
            <Library className="h-5 w-5" />
          </Link>
        </Button>
        <span className="text-[10px] font-black tracking-[0.25em] uppercase text-white/35">Now Playing</span>
        <Button variant="ghost" size="icon"
          className="w-9 h-9 rounded-full text-white/50 hover:text-white hover:bg-white/10"
          onClick={() => setIsQueueOpen(true)}>
          <ListOrdered className="h-5 w-5" />
        </Button>
      </div>

      {/* Card carousel — flex-1 fills whatever vertical space is left */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full max-w-sm mx-auto min-h-0 px-2">
        {cards.length > 0 ? (
          <>
            <div className="w-full [overflow-x:clip] py-6 landscape-compact:py-2 px-10 landscape-compact:px-6" ref={emblaRef}>
              <div className="flex touch-pan-y">
                {cards.map((card, i) => (
                  <div key={card.id} className="flex-[0_0_100%] min-w-0 flex justify-center items-center">
                    <SoundmapCard
                      card={card}
                      title={currentSong.title}
                      artist={currentSong.artist}
                      genre={currentSong.genre}
                      size="hero"
                      className={cn(
                        'transition-all duration-400 ease-out',
                        i === activeCardIndex ? 'scale-100 opacity-100' : 'scale-90 opacity-35',
                      )}
                    />
                  </div>
                ))}
              </div>
            </div>
            {cards.length > 1 && (
              <div className="flex items-center justify-center gap-2 mt-1 shrink-0">
                {cards.map((_, i) => (
                  <div key={i}
                    className={cn(
                      'h-1 rounded-full transition-all duration-300',
                      i === activeCardIndex ? 'w-5 bg-white' : 'w-1 bg-white/25',
                    )}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="w-[240px] sm:w-[280px] aspect-[2/3] rounded-2xl bg-white/5 border-2 border-white/10 flex flex-col items-center justify-center p-8 text-center">
            <ListMusic className="w-12 h-12 text-white/20 mb-4" />
            <p className="font-bold text-lg mb-1">{currentSong.title}</p>
            <p className="text-white/50 text-sm">{currentSong.artist}</p>
            <div className="mt-4 px-3 py-1.5 rounded-full bg-white/10 text-[10px] font-bold uppercase tracking-widest text-white/35">
              No Cards Yet
            </div>
          </div>
        )}
      </div>

      {/* Queue sheet — full overlay within Home */}
      {isQueueOpen && (
        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-2xl flex flex-col">
          <div className="flex justify-between items-center px-6 pt-12 pb-4 shrink-0">
            <div>
              <h3 className="text-xl font-bold">Up Next</h3>
              <p className="text-white/35 text-sm mt-0.5">
                {queue.length} song{queue.length !== 1 ? 's' : ''} in queue
              </p>
            </div>
            <Button variant="ghost" size="sm"
              className="rounded-full px-4 border border-white/15 text-white/70 hover:text-white"
              onClick={() => setIsQueueOpen(false)}>
              Done
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-6 min-h-0">
            {queue.length === 0 ? (
              <div className="text-center py-24">
                <p className="text-white/25 text-sm">Queue is empty</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {queue.map((song, i) => {
                  const isCurrent = song.id === currentSong.id;
                  return (
                    <div key={`${song.id}-${i}`}
                      className={cn(
                        'flex items-center gap-3 px-3 py-3 rounded-xl transition-colors',
                        isCurrent ? 'bg-white/12' : 'hover:bg-white/5',
                      )}>
                      <div className={cn(
                        'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-mono',
                        isCurrent ? 'bg-white text-black font-bold' : 'bg-white/8 text-white/40',
                      )}>
                        {isCurrent ? <Volume2 className="h-3.5 w-3.5" /> : i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm font-semibold truncate', isCurrent ? 'text-white' : 'text-white/75')}>
                          {song.title}
                        </p>
                        <p className="text-xs text-white/35 truncate">{song.artist}</p>
                      </div>
                      {isCurrent && isPlaying && (
                        <div className="shrink-0 flex items-end gap-[2px] h-4">
                          {[0, 1, 2].map(j => (
                            <div key={j}
                              className="w-[3px] bg-white rounded-full animate-[bounce_0.9s_ease-in-out_infinite]"
                              style={{ height: `${8 + j * 3}px`, animationDelay: `${j * 0.18}s` }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
