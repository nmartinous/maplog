import React, { useRef } from 'react';
import { usePlayer } from '@/context/AudioPlayerContext';
import { Link } from 'wouter';
import { Play, Pause, SkipBack, SkipForward, Music2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

  // ── Idle state ──────────────────────────────────────────────────────────────
  if (!currentSong) {
    return (
      <div className="fixed bottom-16 sm:bottom-0 left-0 right-0 h-16 bg-card/80 backdrop-blur-md border-t border-border z-40 sm:z-50 px-5 flex items-center justify-between select-none">
        <div className="flex items-center gap-3 opacity-35">
          <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center shrink-0">
            <Music2 className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">Nothing playing</span>
            <span className="text-xs text-muted-foreground">Tap a card to play</span>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-15 pointer-events-none">
          <div className="h-9 w-9" />
          <div className="h-9 w-9 flex items-center justify-center">
            <Play className="h-4 w-4 ml-0.5" />
          </div>
          <div className="h-9 w-9 flex items-center justify-center">
            <SkipForward className="h-4 w-4" />
          </div>
        </div>
      </div>
    );
  }

  // ── Active state ────────────────────────────────────────────────────────────
  return (
    <div className="fixed bottom-16 sm:bottom-0 left-0 right-0 h-16 bg-card/92 backdrop-blur-md border-t border-border z-40 sm:z-50 flex flex-col">

      {/* Interactive scrubber */}
      <div
        ref={barRef}
        className="w-full h-1 bg-muted cursor-pointer group shrink-0 relative"
        onClick={handleScrub}
        onTouchStart={handleScrub}
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Playback progress"
      >
        <div className="h-full bg-primary transition-all duration-100 ease-linear" style={{ width: `${progress}%` }} />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-primary shadow opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          style={{ left: `calc(${progress}% - 5px)` }}
        />
        {/* Larger tap target */}
        <div className="absolute inset-x-0 -top-3 -bottom-3" />
      </div>

      {/* Content row */}
      <div className="flex-1 flex items-center px-3 gap-2 min-w-0">

        {/* Artwork → opens full player */}
        <Link href="/" className="shrink-0 cursor-pointer">
          <div className="w-9 h-9 rounded-md bg-muted overflow-hidden">
            {currentSong.artworkUrl ? (
              <img src={currentSong.artworkUrl} alt={currentSong.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Music2 className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
          </div>
        </Link>

        {/* Title + time → opens full player */}
        <Link href="/" className="flex-1 min-w-0 cursor-pointer">
          <p className="text-sm font-bold truncate text-foreground leading-tight">{currentSong.title}</p>
          <p className="text-[11px] text-muted-foreground truncate leading-tight">
            {currentSong.artist}
            {duration > 0 && (
              <span className="ml-1.5 opacity-60">{fmt(currentTime)} / {fmt(duration)}</span>
            )}
          </p>
        </Link>

        {/* Transport */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" onClick={skipPrev} aria-label="Previous">
            <SkipBack className="h-4 w-4 fill-current" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-foreground" onClick={isPlaying ? pause : resume} aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" onClick={skipNext} aria-label="Next">
            <SkipForward className="h-4 w-4 fill-current" />
          </Button>
        </div>
      </div>
    </div>
  );
}
