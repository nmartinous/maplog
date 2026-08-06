import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, ListPlus } from 'lucide-react';
import { usePlayer } from '@/context/AudioPlayerContext';
import type { MaplogSong } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ArtMenuProps {
  song: MaplogSong;
  children: React.ReactNode;
  className?: string;
}

/**
 * Wraps album art with a tap-to-open contextual menu.
 *
 * "Play" — if songs are queued ahead, replaces only the current track and
 *           keeps the rest of the queue intact; otherwise starts fresh.
 * "Add to Queue" — appends without interrupting playback.
 *
 * Rendered via a portal. All portal events call e.stopPropagation() so they
 * cannot bubble through React's synthetic tree to the parent row's onClick.
 */
export function ArtMenu({ song, children, className }: ArtMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0, above: false });
  const { play, enqueue, replaceCurrentSong, queue, queueIndex } = usePlayer();

  const hasUpcoming = queue.slice(queueIndex + 1).length > 0;

  const handleTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Don't re-open if already open (can happen if a portal event bubbles here
    // despite stopPropagation on the portal elements — extra safety guard).
    if (open) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const above = spaceBelow < 100;
    setMenuPos({
      x: rect.left + rect.width / 2,
      y: above ? rect.top : rect.bottom,
      above,
    });
    setOpen(true);
  };

  const close = (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent bubbling through React's component tree
    setOpen(false);
  };

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasUpcoming) {
      replaceCurrentSong(song);
    } else {
      play(song, [song]);
    }
    setOpen(false);
  };

  const handleEnqueue = (e: React.MouseEvent) => {
    e.stopPropagation();
    enqueue(song);
    setOpen(false);
  };

  return (
    <>
      <div
        onClick={handleTap}
        role="button"
        aria-label={`Play options for ${song.title}`}
        className={cn('cursor-pointer', className)}
      >
        {children}
      </div>

      {createPortal(
        <AnimatePresence>
          {open && (
            <>
              {/* Backdrop — stopPropagation prevents React tree bubbling */}
              <div className="fixed inset-0 z-40" onClick={close} />

              {/* Menu */}
              <motion.div
                initial={{ opacity: 0, scale: 0.88, y: menuPos.above ? 6 : -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.88, y: menuPos.above ? 6 : -6 }}
                transition={{ type: 'spring', stiffness: 420, damping: 30, duration: 0.15 }}
                style={{
                  position: 'fixed',
                  left: menuPos.x,
                  top: menuPos.above ? undefined : menuPos.y + 6,
                  bottom: menuPos.above ? window.innerHeight - menuPos.y + 6 : undefined,
                  transform: 'translateX(-50%)',
                  zIndex: 50,
                  minWidth: 160,
                }}
                className="bg-[#1c1c22] border border-white/15 rounded-2xl shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()} // catch any bubbling from children
              >
                <button
                  onClick={handlePlay}
                  className="flex items-center gap-3 w-full px-4 py-3 text-sm font-bold text-white hover:bg-white/10 active:bg-white/15 transition-colors border-b border-white/8"
                >
                  <Play className="w-4 h-4 text-primary fill-primary shrink-0" />
                  {hasUpcoming ? 'Play Now' : 'Play'}
                </button>
                <button
                  onClick={handleEnqueue}
                  className="flex items-center gap-3 w-full px-4 py-3 text-sm font-bold text-white/80 hover:bg-white/10 active:bg-white/15 transition-colors"
                >
                  <ListPlus className="w-4 h-4 text-white/50 shrink-0" />
                  Add to Queue
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
