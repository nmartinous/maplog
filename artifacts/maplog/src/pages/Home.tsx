import React, { useEffect, useState } from 'react';
import { usePlayer } from '@/context/AudioPlayerContext';
import { useGetSong, getGetSongQueryKey } from '@workspace/api-client-react';
import { Link } from 'wouter';
import useEmblaCarousel from 'embla-carousel-react';
import {
  Play, Pause, SkipBack, SkipForward, Library, ListMusic,
  Shuffle, Repeat, Repeat1, ListOrdered, Volume2, ChevronDown,
} from 'lucide-react';
import { SoundmapCard } from '@/components/SoundmapCard';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function Home() {
  const { currentSong, isPlaying, pause, resume, skipNext, skipPrev, currentTime, duration, seek, activeCardIndex, setActiveCardIndex, queue } = usePlayer();
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<'off' | 'all' | 'one'>('off');

  const { data: songDetail } = useGetSong(currentSong?.id || 0, {
    query: {
      enabled: !!currentSong?.id,
      queryKey: getGetSongQueryKey(currentSong?.id || 0),
    },
  });

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, startIndex: activeCardIndex });

  useEffect(() => {
    if (emblaApi) {
      emblaApi.on('select', () => setActiveCardIndex(emblaApi.selectedScrollSnap()));
    }
  }, [emblaApi, setActiveCardIndex]);

  useEffect(() => {
    if (emblaApi && activeCardIndex !== emblaApi.selectedScrollSnap()) {
      emblaApi.scrollTo(activeCardIndex);
    }
  }, [emblaApi, activeCardIndex]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const cycleRepeat = () =>
    setRepeat(r => r === 'off' ? 'all' : r === 'all' ? 'one' : 'off');

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

  const cards = songDetail?.cards || [];

  return (
    <div className="h-[calc(100dvh-4rem)] sm:h-[100dvh] bg-black text-white flex flex-col relative overflow-hidden">

      {/* Blurred art background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {cards[activeCardIndex]?.artworkUrl ? (
          <img
            src={cards[activeCardIndex].artworkUrl!}
            alt=""
            className="w-full h-full object-cover blur-3xl scale-150 opacity-30"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 blur-3xl" />
        )}
        {/* Extra darkening overlay so controls stay readable */}
        <div className="absolute inset-0 bg-black/50" />
      </div>

      {/* ── Top bar ───────────────────────────────────────────────── */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-10 pb-2">
        <Button
          variant="ghost" size="icon"
          className="w-9 h-9 rounded-full text-white/50 hover:text-white hover:bg-white/10"
          asChild
        >
          <Link href="/collection">
            <ChevronDown className="h-5 w-5" />
          </Link>
        </Button>

        <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-white/40">
          Now Playing
        </span>

        <Button
          variant="ghost" size="icon"
          className="w-9 h-9 rounded-full text-white/50 hover:text-white hover:bg-white/10"
          onClick={() => setIsQueueOpen(true)}
        >
          <ListOrdered className="h-5 w-5" />
        </Button>
      </div>

      {/* ── Card carousel ─────────────────────────────────────────── */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto px-6 min-h-0">
        {cards.length > 0 ? (
          <>
            <div className="w-full overflow-hidden" ref={emblaRef}>
              <div className="flex touch-pan-y">
                {cards.map((card, i) => (
                  <div key={card.id} className="flex-[0_0_100%] min-w-0 flex justify-center items-center py-4">
                    <SoundmapCard
                      card={card}
                      title={currentSong.title}
                      artist={currentSong.artist}
                      genre={currentSong.genre}
                      size="hero"
                      className={cn(
                        'transition-all duration-500 ease-out',
                        i === activeCardIndex ? 'scale-100 opacity-100' : 'scale-90 opacity-40'
                      )}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Card dots */}
            {cards.length > 1 && (
              <div className="flex items-center justify-center gap-2 mt-3">
                {cards.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'h-1 rounded-full transition-all duration-300',
                      i === activeCardIndex ? 'w-5 bg-white' : 'w-1 bg-white/25'
                    )}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="w-[280px] sm:w-[320px] aspect-[2/3] rounded-2xl bg-white/5 border-2 border-white/10 flex flex-col items-center justify-center p-8 text-center">
            <ListMusic className="w-16 h-16 text-white/20 mb-6" />
            <h2 className="text-xl font-bold mb-1">{currentSong.title}</h2>
            <p className="text-white/50 text-sm">{currentSong.artist}</p>
            <div className="mt-6 px-3 py-1.5 rounded-full bg-white/10 text-[10px] font-semibold uppercase tracking-widest text-white/40">
              No Cards Collected
            </div>
          </div>
        )}
      </div>

      {/* ── Controls area ─────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-md mx-auto px-8 pb-6 flex flex-col gap-5">

        {/* Scrubber */}
        <div className="flex flex-col gap-1.5">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={1}
            onValueChange={([val]) => seek(val)}
            className="w-full [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:bg-white [&_[role=slider]]:border-0 [&_[role=slider]]:shadow-[0_0_8px_rgba(255,255,255,0.6)] [&_.bg-primary]:bg-white"
          />
          <div className="flex justify-between text-[11px] font-mono text-white/35">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Main transport */}
        <div className="flex items-center justify-between">
          {/* Shuffle */}
          <button
            onClick={() => setShuffle(s => !s)}
            className={cn(
              'p-2 rounded-full transition-colors',
              shuffle ? 'text-white' : 'text-white/30 hover:text-white/60'
            )}
          >
            <Shuffle className="h-5 w-5" strokeWidth={shuffle ? 2.5 : 1.8} />
          </button>

          {/* Skip Back */}
          <button
            onClick={skipPrev}
            className="p-2 text-white/80 hover:text-white transition-colors"
          >
            <SkipBack className="h-8 w-8" fill="currentColor" />
          </button>

          {/* Play / Pause */}
          <button
            onClick={isPlaying ? pause : resume}
            className="w-[68px] h-[68px] rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_32px_rgba(255,255,255,0.25)] hover:bg-white/90 hover:scale-105 active:scale-95 transition-all"
          >
            {isPlaying
              ? <Pause className="h-7 w-7" fill="currentColor" />
              : <Play className="h-7 w-7 ml-0.5" fill="currentColor" />
            }
          </button>

          {/* Skip Forward */}
          <button
            onClick={skipNext}
            className="p-2 text-white/80 hover:text-white transition-colors"
          >
            <SkipForward className="h-8 w-8" fill="currentColor" />
          </button>

          {/* Repeat */}
          <button
            onClick={cycleRepeat}
            className={cn(
              'p-2 rounded-full transition-colors relative',
              repeat !== 'off' ? 'text-white' : 'text-white/30 hover:text-white/60'
            )}
          >
            {repeat === 'one'
              ? <Repeat1 className="h-5 w-5" strokeWidth={2.5} />
              : <Repeat className="h-5 w-5" strokeWidth={repeat === 'all' ? 2.5 : 1.8} />
            }
          </button>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-3">
          <Volume2 className="h-4 w-4 text-white/30 shrink-0" />
          <Slider
            defaultValue={[80]}
            max={100}
            step={1}
            className="flex-1 [&_[role=slider]]:h-2.5 [&_[role=slider]]:w-2.5 [&_[role=slider]]:bg-white [&_[role=slider]]:border-0 [&_.bg-primary]:bg-white [&_.bg-secondary]:bg-white/20"
          />
          <Volume2 className="h-4 w-4 text-white/60 shrink-0" />
        </div>
      </div>

      {/* ── Queue sheet ───────────────────────────────────────────── */}
      {isQueueOpen && (
        <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-2xl flex flex-col">
          {/* Sheet header */}
          <div className="flex justify-between items-center px-6 pt-12 pb-4">
            <div>
              <h3 className="text-xl font-bold">Up Next</h3>
              <p className="text-white/35 text-sm mt-0.5">{queue.length} song{queue.length !== 1 ? 's' : ''} in queue</p>
            </div>
            <Button
              variant="ghost" size="sm"
              className="rounded-full px-4 border border-white/15 text-white/70 hover:text-white"
              onClick={() => setIsQueueOpen(false)}
            >
              Done
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-8">
            {queue.length === 0 ? (
              <div className="text-center py-24">
                <p className="text-white/25 text-sm">Queue is empty</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {queue.map((song, i) => {
                  const isCurrent = song.id === currentSong?.id;
                  return (
                    <div
                      key={`${song.id}-${i}`}
                      className={cn(
                        'flex items-center gap-3 px-3 py-3 rounded-xl transition-colors',
                        isCurrent ? 'bg-white/12' : 'hover:bg-white/5'
                      )}
                    >
                      <div className={cn(
                        'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-mono',
                        isCurrent ? 'bg-white text-black font-bold' : 'bg-white/8 text-white/40'
                      )}>
                        {isCurrent ? <Volume2 className="h-3.5 w-3.5" /> : i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm font-semibold truncate', isCurrent ? 'text-white' : 'text-white/75')}>{song.title}</p>
                        <p className="text-xs text-white/35 truncate">{song.artist}</p>
                      </div>
                      {isCurrent && (
                        <div className="shrink-0 flex items-end gap-[2px] h-4">
                          {[0, 1, 2].map(j => (
                            <div
                              key={j}
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
