import React, { useEffect, useState } from 'react';
import { usePlayer } from '@/context/AudioPlayerContext';
import { useGetSong, getGetSongQueryKey, SongDetail } from '@workspace/api-client-react';
import { Link } from 'wouter';
import useEmblaCarousel from 'embla-carousel-react';
import { Play, Pause, SkipBack, SkipForward, Menu, Library, ListMusic, Volume2 } from 'lucide-react';
import { SoundmapCard } from '@/components/SoundmapCard';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function Home() {
  const { currentSong, isPlaying, play, pause, resume, skipNext, skipPrev, currentTime, duration, seek, activeCardIndex, setActiveCardIndex, queue } = usePlayer();
  const [isQueueOpen, setIsQueueOpen] = useState(false);

  const { data: songDetail } = useGetSong(currentSong?.id || 0, { 
    query: { 
      enabled: !!currentSong?.id, 
      queryKey: getGetSongQueryKey(currentSong?.id || 0) 
    } 
  });

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, startIndex: activeCardIndex });

  useEffect(() => {
    if (emblaApi) {
      emblaApi.on('select', () => {
        setActiveCardIndex(emblaApi.selectedScrollSnap());
      });
    }
  }, [emblaApi, setActiveCardIndex]);

  useEffect(() => {
    if (emblaApi && activeCardIndex !== emblaApi.selectedScrollSnap()) {
      emblaApi.scrollTo(activeCardIndex);
    }
  }, [emblaApi, activeCardIndex]);

  if (!currentSong) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 rounded-2xl bg-muted/50 flex items-center justify-center mb-6">
          <ListMusic className="w-12 h-12 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold mb-2">No song playing</h1>
        <p className="text-muted-foreground mb-8">Select a song from your collection to start listening.</p>
        <Link href="/collection">
          <Button size="lg" className="rounded-full font-bold px-8">
            <Library className="mr-2 h-5 w-5" />
            Go to Collection
          </Button>
        </Link>
      </div>
    );
  }

  const formatTime = (timeMs: number) => {
    const totalSeconds = Math.floor(timeMs);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const cards = songDetail?.cards || [];

  return (
    <div className="min-h-[100dvh] bg-black text-white flex flex-col relative overflow-hidden">
      {/* Dynamic blurred background based on current card if any */}
      <div className="absolute inset-0 z-0 opacity-40 mix-blend-screen overflow-hidden pointer-events-none">
        {cards[activeCardIndex]?.artworkUrl ? (
          <img src={cards[activeCardIndex].artworkUrl!} alt="" className="w-full h-full object-cover blur-3xl scale-150" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/30 to-secondary/30 blur-3xl" />
        )}
      </div>

      {/* Top Bar */}
      <div className="relative z-10 flex items-center justify-between p-6 pt-12">
        <Button variant="ghost" size="icon" className="text-white/70 hover:text-white rounded-full" asChild>
          <Link href="/collection">
            <Library className="h-6 w-6" />
          </Link>
        </Button>
        <div className="text-xs font-bold tracking-widest uppercase text-white/50">
          Now Playing
        </div>
        <Button variant="ghost" size="icon" className="text-white/70 hover:text-white rounded-full" onClick={() => setIsQueueOpen(!isQueueOpen)}>
          <Menu className="h-6 w-6" />
        </Button>
      </div>

      {/* Album Art / Cards Carousel */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto px-8">
        {cards.length > 0 ? (
          <div className="w-full overflow-hidden" ref={emblaRef}>
            <div className="flex touch-pan-y">
              {cards.map((card, i) => (
                <div key={card.id} className="flex-[0_0_100%] min-w-0 flex justify-center items-center py-8">
                  <SoundmapCard 
                    card={card} 
                    title={currentSong.title} 
                    artist={currentSong.artist} 
                    size="hero"
                    className={cn(
                      "transition-all duration-500 ease-out",
                      i === activeCardIndex ? "scale-100 opacity-100" : "scale-90 opacity-50"
                    )}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="w-[280px] sm:w-[320px] aspect-[2/3] rounded-2xl bg-white/5 border-2 border-white/10 flex flex-col items-center justify-center p-8 text-center card-effect">
            <ListMusic className="w-16 h-16 text-white/20 mb-6" />
            <h2 className="text-2xl font-bold mb-2">{currentSong.title}</h2>
            <p className="text-white/60">{currentSong.artist}</p>
            <div className="mt-8 px-4 py-2 rounded-full bg-white/10 text-xs font-medium uppercase tracking-widest text-white/60">
              No Cards Collected
            </div>
          </div>
        )}

        {/* Dots */}
        {cards.length > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            {cards.map((_, i) => (
              <div 
                key={i} 
                className={cn("h-1.5 rounded-full transition-all duration-300", i === activeCardIndex ? "w-6 bg-white" : "w-1.5 bg-white/30")}
              />
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="relative z-10 p-6 sm:p-8 max-w-md w-full mx-auto pb-12">
        <div className="mb-6 flex justify-between items-end">
          <div className="min-w-0 flex-1 pr-4">
            <h2 className="text-2xl font-bold truncate">{currentSong.title}</h2>
            <p className="text-white/60 text-lg truncate">{currentSong.artist}</p>
          </div>
        </div>

        <div className="mb-8">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={1}
            onValueChange={([val]) => seek(val)}
            className="w-full [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:bg-white [&_.bg-primary]:bg-white"
          />
          <div className="flex justify-between text-xs font-mono text-white/50 mt-2">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-6">
          <Button variant="ghost" size="icon" className="h-14 w-14 text-white/70 hover:text-white rounded-full hover:bg-white/10" onClick={skipPrev}>
            <SkipBack className="h-7 w-7" />
          </Button>
          
          <Button 
            className="h-20 w-20 rounded-full bg-white text-black hover:bg-white/90 hover:scale-105 transition-all shadow-[0_0_30px_rgba(255,255,255,0.3)]" 
            onClick={isPlaying ? pause : resume}
          >
            {isPlaying ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8 ml-1" />}
          </Button>

          <Button variant="ghost" size="icon" className="h-14 w-14 text-white/70 hover:text-white rounded-full hover:bg-white/10" onClick={skipNext}>
            <SkipForward className="h-7 w-7" />
          </Button>
        </div>
      </div>
      
      {/* Queue Mini Panel */}
      {isQueueOpen && (
        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-2xl flex flex-col p-6 pt-safe animate-in fade-in slide-in-from-bottom-10">
          <div className="flex justify-between items-center mb-8 pt-6">
            <div>
              <h3 className="text-2xl font-bold">Up Next</h3>
              <p className="text-white/40 text-sm mt-0.5">{queue.length} songs in queue</p>
            </div>
            <Button variant="ghost" size="sm" className="text-white/70 hover:text-white rounded-full border border-white/10" onClick={() => setIsQueueOpen(false)}>
              Done
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto pb-20 -mx-2 px-2">
            {queue.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-white/30 text-sm">Queue is empty</p>
              </div>
            ) : (
              <div className="space-y-1">
                {queue.map((song, i) => {
                  const isCurrent = song.id === currentSong?.id;
                  return (
                    <div
                      key={`${song.id}-${i}`}
                      className={cn(
                        "flex items-center gap-3 px-3 py-3 rounded-xl transition-colors",
                        isCurrent ? "bg-white/15" : "hover:bg-white/5"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-mono",
                        isCurrent ? "bg-white text-black font-bold" : "bg-white/10 text-white/50"
                      )}>
                        {isCurrent ? <Volume2 className="h-4 w-4" /> : i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm font-semibold truncate", isCurrent ? "text-white" : "text-white/80")}>{song.title}</p>
                        <p className="text-xs text-white/40 truncate">{song.artist}</p>
                      </div>
                      {isCurrent && (
                        <div className="shrink-0 flex gap-0.5">
                          {[0, 1, 2].map(j => (
                            <div key={j} className="w-0.5 bg-white rounded-full animate-[bounce_1s_ease-in-out_infinite]" style={{ height: `${10 + j * 4}px`, animationDelay: `${j * 0.15}s` }} />
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
