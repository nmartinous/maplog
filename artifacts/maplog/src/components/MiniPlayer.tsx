import React, { useRef, useState } from 'react';
import { usePlayer } from '@/context/AudioPlayerContext';
import { Link } from 'wouter';
import { Play, Pause, SkipBack, SkipForward, Music2, Shuffle, Repeat, Repeat1, Infinity as InfinityIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export function MiniPlayer() {
  const {
    currentSong, isPlaying, pause, resume, skipNext, skipPrev, seek, currentTime, duration,
    shuffle, repeat, autoplay, toggleShuffle, cycleRepeat, toggleAutoplay,
  } = usePlayer();
  const barRef = useRef<HTMLDivElement>(null);
  const [dragRatio, setDragRatio] = useState<number | null>(null);

  const progress = dragRatio !== null
    ? dragRatio * 100
    : duration > 0 ? (currentTime / duration) * 100 : 0;

  const ratioFromClientX = (clientX: number) => {
    if (!barRef.current) return 0;
    const rect = barRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  // Pointer-based scrubbing: press → drag → release to seek
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDragRatio(ratioFromClientX(e.clientX));
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRatio === null) return;
    setDragRatio(ratioFromClientX(e.clientX));
  };
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRatio === null) return;
    seek(ratioFromClientX(e.clientX) * duration);
    setDragRatio(null);
  };

  const detailHref = currentSong ? `/song/${encodeURIComponent(currentSong.id)}` : '/';
  const RepeatIcon = repeat === 'one' ? Repeat1 : Repeat;

  return (
    <div className="shrink-0 px-2 sm:px-4 py-2 sm:py-3 z-40 relative bg-transparent pointer-events-none">
      <AnimatePresence mode="popLayout" initial={false}>
        {!currentSong ? (
          <motion.div 
            key="empty"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="w-full h-14 sm:h-16 rounded-2xl glass-panel flex items-center justify-between px-4 pointer-events-auto"
          >
            <div className="flex items-center gap-3 opacity-40">
              <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                <Music2 className="w-4 h-4 text-white" />
              </div>
              <p className="text-sm font-semibold">Nothing playing</p>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="playing"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="w-full rounded-2xl glass-panel overflow-hidden pointer-events-auto shadow-2xl flex flex-col relative"
          >
            {/* Glowing background hint from artwork */}
            <div className="absolute inset-0 z-0 opacity-20 pointer-events-none mix-blend-screen">
              {currentSong.artworkUrl && (
                <img src={currentSong.artworkUrl} alt="" className="w-full h-full object-cover blur-2xl transform scale-150" />
              )}
            </div>

            {/* Scrub bar (interactive) — track is inset from the edges;
                barRef sits on the visible rail so seek math maps its ends to 0..1 */}
            <div
              className="relative w-full h-6 z-30 cursor-pointer touch-none group flex items-center px-4 pt-1"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={() => setDragRatio(null)}
              role="slider"
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(dragRatio !== null ? dragRatio * duration : currentTime)}
            >
              <div ref={barRef} className={cn(
                'w-full bg-white/10 rounded-full overflow-visible relative transition-all',
                dragRatio !== null ? 'h-[6px]' : 'h-[3px] group-hover:h-[5px]',
              )}>
                <div
                  className={cn('h-full bg-primary rounded-full relative', dragRatio === null && 'transition-all duration-100 ease-linear')}
                  style={{ width: `${progress}%` }}
                >
                  <div className={cn(
                    'absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all',
                    dragRatio !== null ? 'w-3 h-3 opacity-100' : 'w-2 h-2 opacity-0 group-hover:opacity-100',
                  )} />
                </div>
              </div>
            </div>

            <div className="flex-1 flex items-center px-3 sm:px-4 pb-4 pt-1.5 sm:pb-5 gap-2.5 sm:gap-3 relative z-10">
              <Link href={detailHref} className="shrink-0 cursor-pointer active:scale-95 transition-transform group" aria-label="Open card view">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-white/10 overflow-hidden relative shadow-md">
                  {currentSong.artworkUrl
                    ? <img src={currentSong.artworkUrl} alt={currentSong.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    : <div className="w-full h-full flex items-center justify-center"><Music2 className="w-5 h-5 text-white/50" /></div>
                  }
                  {isPlaying && (
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex items-end gap-[2px] h-3">
                        {[0, 1, 2].map(j => (
                          <div key={j} className="w-1 bg-white rounded-full animate-[bounce_0.8s_ease-in-out_infinite]" style={{ height: `${6 + j * 3}px`, animationDelay: `${j * 0.15}s` }} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Link>

              <Link href={detailHref} className="flex-1 min-w-0 cursor-pointer active:opacity-70 transition-opacity">
                <p className="text-[15px] sm:text-base font-bold truncate text-white leading-tight">{currentSong.title}</p>
                <p className="text-xs sm:text-[13px] text-white/60 truncate leading-tight mt-0.5">
                  {currentSong.artist}
                </p>
              </Link>

              <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0">
                <Button
                  variant="ghost" size="icon"
                  className={cn(
                    'h-8 w-8 sm:h-9 sm:w-9 rounded-full active:scale-90 transition-all hover:bg-white/10',
                    shuffle ? 'text-primary' : 'text-white/40 hover:text-white',
                  )}
                  onClick={toggleShuffle} aria-label="Shuffle" aria-pressed={shuffle}
                >
                  <Shuffle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 sm:h-9 sm:w-9 text-white/60 hover:text-white hover:bg-white/10 rounded-full active:scale-90 transition-all"
                  onClick={skipPrev} aria-label="Previous"
                >
                  <SkipBack className="h-4 w-4 fill-current" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  className="h-12 w-12 bg-white text-black hover:bg-white/90 hover:scale-105 active:scale-95 rounded-full transition-all shadow-lg"
                  onClick={isPlaying ? pause : resume}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying
                    ? <Pause className="h-4 w-4 fill-current" />
                    : <Play className="h-4 w-4 fill-current ml-0.5" />
                  }
                </Button>
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 sm:h-9 sm:w-9 text-white/60 hover:text-white hover:bg-white/10 rounded-full active:scale-90 transition-all"
                  onClick={skipNext} aria-label="Next"
                >
                  <SkipForward className="h-4 w-4 fill-current" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  className={cn(
                    'h-8 w-8 sm:h-9 sm:w-9 rounded-full active:scale-90 transition-all hover:bg-white/10 relative',
                    repeat !== 'off' ? 'text-primary' : 'text-white/40 hover:text-white',
                  )}
                  onClick={cycleRepeat}
                  aria-label={repeat === 'off' ? 'Repeat off' : repeat === 'all' ? 'Repeat all' : 'Repeat one'}
                >
                  <RepeatIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  className={cn(
                    'hidden sm:inline-flex h-8 w-8 rounded-full active:scale-90 transition-all hover:bg-white/10',
                    autoplay ? 'text-primary' : 'text-white/40 hover:text-white',
                  )}
                  onClick={toggleAutoplay} aria-label="Autoplay" aria-pressed={autoplay}
                >
                  <InfinityIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
