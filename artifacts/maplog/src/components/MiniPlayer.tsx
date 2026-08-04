import React from 'react';
import { usePlayer } from '@/context/AudioPlayerContext';
import { Link } from 'wouter';
import { Play, Pause, SkipForward, Music2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function MiniPlayer() {
  const { currentSong, isPlaying, pause, resume, skipNext, currentTime, duration } = usePlayer();

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // ── Idle state (no song loaded) ────────────────────────────────────────────
  if (!currentSong) {
    return (
      <div className="fixed bottom-16 sm:bottom-0 left-0 right-0 h-16 bg-card/80 backdrop-blur-md border-t border-border z-40 sm:z-50 px-5 flex items-center justify-between">
        <div className="flex items-center gap-3 opacity-40 select-none">
          <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center shrink-0">
            <Music2 className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">Nothing playing</span>
            <span className="text-xs text-muted-foreground">Tap a card to play</span>
          </div>
        </div>
        {/* Placeholder controls — visually consistent, non-interactive */}
        <div className="flex items-center gap-2 opacity-20 pointer-events-none">
          <div className="h-8 w-8 rounded-full flex items-center justify-center">
            <Play className="h-4 w-4 ml-0.5" />
          </div>
          <div className="h-8 w-8 rounded-full flex items-center justify-center">
            <SkipForward className="h-4 w-4" />
          </div>
        </div>
      </div>
    );
  }

  // ── Active state ───────────────────────────────────────────────────────────
  return (
    <div className="fixed bottom-16 sm:bottom-0 left-0 right-0 h-16 bg-card/90 backdrop-blur-md border-t border-border z-40 sm:z-50 px-4 flex items-center justify-between">
      {/* Progress bar — top edge */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Song info — tapping navigates to the full player */}
      <Link href="/" className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
        {/* Mini artwork — uses artwork URL if available */}
        <div className="w-10 h-10 rounded-md bg-muted shrink-0 overflow-hidden">
          {(currentSong as any).cards?.[0]?.artworkUrl ? (
            <img
              src={(currentSong as any).cards[0].artworkUrl}
              alt={currentSong.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music2 className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold truncate text-foreground">{currentSong.title}</span>
          <span className="text-xs text-muted-foreground truncate">{currentSong.artist}</span>
        </div>
      </Link>

      {/* Controls */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-foreground"
          onClick={isPlaying ? pause : resume}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground"
          onClick={skipNext}
        >
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
