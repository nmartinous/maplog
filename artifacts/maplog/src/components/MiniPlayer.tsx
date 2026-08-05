import React, { useRef } from 'react';
import { usePlayer } from '@/context/AudioPlayerContext';
import { Link } from 'wouter';
import { Play, Pause, SkipBack, SkipForward, Music2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function MiniPlayer() {
  const { currentSong, isPlaying, pause, resume, skipNext, skipPrev, seek, currentTime, duration } = usePlayer();
  const barRef = useRef<HTMLDivElement>(null);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleScrub = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!barRef.current || duration <= 0) return;
    const rect = barRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    seek(ratio * duration);
  };

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
            {/* Scrubber Background */}
            <div className="absolute top-0 left-0 w-full h-[2px] bg-white/5 z-20">
              <div 
                className="h-full bg-primary relative transition-all duration-100 ease-linear"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            
            {/* Scrubber Hitbox */}
            <div
              ref={barRef}
              className="absolute top-0 left-0 w-full h-4 -translate-y-2 z-30 cursor-pointer group"
              onClick={handleScrub}
              onTouchStart={handleScrub}
            />

            {/* Glowing background hint from artwork */}
            <div className="absolute inset-0 z-0 opacity-20 pointer-events-none mix-blend-screen">
              {currentSong.artworkUrl && (
                <img src={currentSong.artworkUrl} alt="" className="w-full h-full object-cover blur-2xl transform scale-150" />
              )}
            </div>

            <div className="flex-1 flex items-center px-3 py-2 sm:py-3 gap-3 relative z-10">
              <Link href="/" className="shrink-0 cursor-pointer active:scale-95 transition-transform group">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/10 overflow-hidden relative shadow-md">
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

              <Link href="/" className="flex-1 min-w-0 cursor-pointer active:opacity-70 transition-opacity">
                <p className="text-sm sm:text-base font-bold truncate text-white leading-tight">{currentSong.title}</p>
                <p className="text-[11px] sm:text-xs text-white/60 truncate leading-tight mt-0.5">
                  {currentSong.artist}
                </p>
              </Link>

              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10 rounded-full active:scale-90 transition-all"
                  onClick={skipPrev} aria-label="Previous"
                >
                  <SkipBack className="h-4 w-4 fill-current" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  className="h-10 w-10 bg-white text-black hover:bg-white/90 hover:scale-105 active:scale-95 rounded-full transition-all shadow-lg"
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
                  className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10 rounded-full active:scale-90 transition-all"
                  onClick={skipNext} aria-label="Next"
                >
                  <SkipForward className="h-4 w-4 fill-current" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
