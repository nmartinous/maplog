import React from 'react';
import { usePlayer } from '@/context/AudioPlayerContext';
import { Link } from 'wouter';
import { Play, Pause, SkipBack, SkipForward, Music2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Compact mini-player — always h-14 so it never pushes the tab bar up.
 * Thin progress line at the top, art → song detail, prev/play|pause/next.
 * Shuffle, repeat, and autoplay are in the QueueSheet.
 */
export function MiniPlayer() {
  const {
    currentSong, isPlaying, pause, resume, skipNext, skipPrev,
    currentTime, duration,
  } = usePlayer();

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const detailHref = currentSong ? `/song/${encodeURIComponent(currentSong.id)}` : '/';

  return (
    <div className="shrink-0 px-2 sm:px-4 py-2 z-40 relative pointer-events-none">
      <AnimatePresence mode="popLayout" initial={false}>
        {!currentSong ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18 }}
            className="w-full h-14 rounded-2xl glass-panel flex items-center px-4 pointer-events-auto"
          >
            <div className="flex items-center gap-3 opacity-35">
              <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                <Music2 className="w-4 h-4 text-white" />
              </div>
              <p className="text-sm font-semibold">Nothing playing</p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="playing"
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="w-full h-14 rounded-2xl glass-panel overflow-hidden pointer-events-auto relative"
          >
            {/* Progress line — always at very top, purely visual */}
            <div className="absolute top-0 left-0 right-0 h-[2px] z-20">
              <div
                className="h-full bg-primary transition-[width] duration-150 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Faint artwork colour wash */}
            {currentSong.artworkUrl && (
              <div className="absolute inset-0 z-0 opacity-15 pointer-events-none mix-blend-screen overflow-hidden">
                <img
                  src={currentSong.artworkUrl}
                  alt=""
                  className="w-full h-full object-cover blur-2xl scale-150"
                />
              </div>
            )}

            <div className="flex items-center gap-2.5 px-3 h-full relative z-10">
              {/* Art — tapping navigates to song detail */}
              <Link href={detailHref} className="shrink-0 active:scale-90 transition-transform">
                <div className="w-9 h-9 rounded-xl bg-white/10 overflow-hidden shadow-md">
                  {currentSong.artworkUrl
                    ? <img src={currentSong.artworkUrl} alt={currentSong.title} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><Music2 className="w-4 h-4 text-white/50" /></div>
                  }
                </div>
              </Link>

              {/* Song info */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-white truncate leading-tight">{currentSong.title}</p>
                <p className="text-[11px] text-white/50 truncate mt-0.5">{currentSong.artist}</p>
              </div>

              {/* Prev / Play-Pause / Next */}
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={skipPrev}
                  className="h-8 w-8 rounded-full text-white/60 hover:text-white hover:bg-white/10 flex items-center justify-center active:scale-90 transition-all"
                  aria-label="Previous"
                >
                  <SkipBack className="h-4 w-4 fill-current" />
                </button>

                <button
                  onClick={isPlaying ? pause : resume}
                  className="h-10 w-10 bg-white text-black hover:bg-white/90 active:scale-90 rounded-full transition-all shadow-md flex items-center justify-center"
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying
                    ? <Pause className="h-4 w-4 fill-current" />
                    : <Play className="h-4 w-4 fill-current ml-0.5" />
                  }
                </button>

                <button
                  onClick={skipNext}
                  className="h-8 w-8 rounded-full text-white/60 hover:text-white hover:bg-white/10 flex items-center justify-center active:scale-90 transition-all"
                  aria-label="Next"
                >
                  <SkipForward className="h-4 w-4 fill-current" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
