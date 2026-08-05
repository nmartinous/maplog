import React, { useEffect, useMemo, useState } from 'react';
import { usePlayer } from '@/context/AudioPlayerContext';
import { useMusicKit } from '@/context/MusicKitContext';
import { Link, Redirect } from 'wouter';
import { Library, Music2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SoundmapCard } from '@/components/SoundmapCard';
import { motion, AnimatePresence } from 'framer-motion';

const CYCLE_MS = 5000;

/**
 * Root route. When something is playing it forwards to the playing song's
 * card view. Otherwise it showcases a random card from the collection,
 * cycling to a new one every 5 seconds with a swipe transition — tap to
 * dive in and start playback.
 */
export default function Home() {
  const { currentSong, play } = usePlayer();
  const { songs } = useMusicKit();

  // Songs that actually have a card to show
  const pool = useMemo(() => songs.filter(s => s.cards.length > 0), [songs]);

  const [pick, setPick] = useState(() =>
    pool.length ? Math.floor(Math.random() * pool.length) : 0,
  );
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (currentSong || pool.length < 2) return;
    const t = setInterval(() => {
      setPick(prev => {
        if (pool.length < 2) return prev;
        let next = Math.floor(Math.random() * (pool.length - 1));
        if (next >= prev) next += 1; // never repeat the same card
        return next;
      });
      setCycle(c => c + 1);
    }, CYCLE_MS);
    return () => clearInterval(t);
  }, [currentSong, pool.length]);

  if (currentSong) {
    return <Redirect to={`/song/${encodeURIComponent(currentSong.id)}`} replace />;
  }

  const song = pool[pick % Math.max(pool.length, 1)];
  const card = song?.cards[0];

  // Empty collection — keep the original landing state
  if (!song || !card) {
    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
        className="h-full w-full flex flex-col items-center justify-center p-6 text-center relative z-10 overflow-hidden bg-background"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none -z-10" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative flex flex-col items-center w-full max-w-sm"
        >
          <div className="w-28 h-28 rounded-[2.5rem] glass-panel flex items-center justify-center mb-8 relative z-10 shadow-2xl border-white/10 overflow-hidden">
            <Music2 className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-black mb-4 text-white tracking-tight">Music Binder</h1>
          <p className="text-white/50 text-sm sm:text-base mb-10 leading-relaxed font-medium">
            Your collection is waiting. Add songs to reveal your cards.
          </p>
          <Link href="/collection">
            <Button size="lg" className="rounded-full font-bold px-8 h-14 shadow-[0_0_40px_-10px_rgba(255,60,0,0.5)] hover:scale-105 active:scale-95 transition-all text-base bg-primary text-white flex items-center gap-3">
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
      className="h-full flex flex-col overflow-hidden relative bg-background w-full"
    >
      {/* Blurred artwork ambience */}
      <AnimatePresence>
        {card.artworkUrl && (
          <motion.div
            key={card.artworkUrl}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 z-0 pointer-events-none overflow-hidden"
          >
            <img
              src={card.artworkUrl}
              alt=""
              className="absolute top-0 left-0 w-full h-[60%] object-cover blur-[80px] scale-150 transform-gpu"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background to-background" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-20 flex items-center justify-center px-5 pt-8 pb-2 shrink-0">
        <span className="text-[11px] font-black tracking-[0.3em] uppercase text-primary animate-pulse">
          Dive in?
        </span>
      </div>

      <div className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center px-4 w-full overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={`${song.id}-${cycle}`}
            initial={{ x: 320, opacity: 0, rotate: 4 }}
            animate={{ x: 0, opacity: 1, rotate: 0 }}
            exit={{ x: -320, opacity: 0, rotate: -4 }}
            transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
            whileTap={{ scale: 0.95 }}
            style={{ willChange: 'transform' }}
            className="cursor-pointer"
            onClick={() => play(song, songs)}
            role="button"
            aria-label={`Play ${song.title}`}
          >
            <SoundmapCard
              card={card}
              title={song.title}
              artist={song.artist}
              genre={song.genre}
              size="lg"
              className="shadow-2xl"
            />
          </motion.div>
        </AnimatePresence>
        <p className="mt-5 text-xs font-semibold text-white/40 shrink-0">
          Tap the card to start playing
        </p>
      </div>
    </motion.div>
  );
}
