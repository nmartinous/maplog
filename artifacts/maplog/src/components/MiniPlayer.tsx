import React from 'react';
import { usePlayer } from '@/context/AudioPlayerContext';
import { Link, useLocation } from 'wouter';
import { Play, Pause, SkipBack, SkipForward, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function MiniPlayer() {
  const { currentSong, isPlaying, play, pause, resume, skipNext, currentTime, duration } = usePlayer();
  const [location] = useLocation();

  // Don't show mini player on Now Playing (full player is shown there)
  if (!currentSong || location === '/') return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed bottom-16 sm:bottom-0 left-0 right-0 h-16 bg-card border-t border-border z-40 sm:z-50 px-4 flex items-center justify-between">
      {/* Progress bar top */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-muted">
        <div 
          className="h-full bg-primary transition-all duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Link href="/" className="w-10 h-10 bg-muted rounded-md flex-shrink-0 overflow-hidden flex items-center justify-center relative cursor-pointer">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20" />
          <span className="text-[8px] font-bold z-10 relative">P</span>
        </Link>
        <Link href="/" className="flex flex-col min-w-0 cursor-pointer">
          <span className="text-sm font-bold truncate text-foreground">{currentSong.title}</span>
          <span className="text-xs text-muted-foreground truncate">{currentSong.artist}</span>
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-foreground" onClick={isPlaying ? pause : resume}>
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={skipNext}>
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
