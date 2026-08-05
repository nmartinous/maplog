import React from 'react';
import { usePlayer } from '@/context/AudioPlayerContext';
import { Link, Redirect } from 'wouter';
import { Library, Music2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

/**
 * The old separate "Now Playing" screen is gone — the song card view
 * (/song/:id) is the single full-screen view. When something is playing,
 * the root route simply forwards to the playing song's card view.
 */
export default function Home() {
  const { currentSong } = usePlayer();

  if (currentSong) {
    return <Redirect to={`/song/${encodeURIComponent(currentSong.id)}`} replace />;
  }

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
