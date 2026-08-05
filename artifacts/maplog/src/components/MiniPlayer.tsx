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

const BASE = 'miniplayer bg-card/92 backdrop-blur-xl border-t border-white/8';

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

  // ── Idle ───────────────────────────────────────────────────────────────────
  if (!currentSong) {
    return (
      <div className={BASE}>
        <div className="h-full flex items-center justify-between px-5">
          <div className="flex items-center gap-3 opacity-35">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Music2 className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold">Nothing playing</p>
              <p className="text-xs text-muted-foreground">Tap a card to play</p>
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
      </div>
    );
  }

  // ── Active ─────────────────────────────────────────────────────────────────
  return (
    <div className={BASE + ' flex flex-col'}>
      {/* Scrubber */}
      <div
        ref={barRef}
        className="w-full h-[3px] bg-white/10 cursor-pointer group relative shrink-0"
        onClick={handleScrub}
        onTouchStart={handleScrub}
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Playback progress"
      >
        <div
          className="h-full bg-primary transition-all duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
        {/* Larger touch target */}
        <div className="absolute inset-x-0 -top-3 -bottom-3" />
      </div>

      {/* Content row */}
      <div className="flex-1 flex items-center px-3 gap-2 min-w-0">
        {/* Artwork → full player */}
        <Link href="/" className="shrink-0 cursor-pointer active:opacity-70 transition-opacity">
          <div className="w-9 h-9 rounded-lg bg-muted overflow-hidden">
            {currentSong.artworkUrl
              ? <img src={currentSong.artworkUrl} alt={currentSong.title} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center"><Music2 className="w-4 h-4 text-muted-foreground" /></div>
            }
          </div>
        </Link>

        {/* Title + time → full player */}
        <Link href="/" className="flex-1 min-w-0 cursor-pointer active:opacity-70 transition-opacity">
          <p className="text-sm font-bold truncate leading-tight">{currentSong.title}</p>
          <p className="text-[11px] text-muted-foreground truncate leading-tight">
            {currentSong.artist}
            {duration > 0 && (
              <span className="ml-1.5 opacity-50 tabular-nums">
                {fmt(currentTime)} / {fmt(duration)}
              </span>
            )}
          </p>
        </Link>

        {/* Transport */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost" size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-foreground active:scale-90 transition-transform"
            onClick={skipPrev} aria-label="Previous"
          >
            <SkipBack className="h-4 w-4 fill-current" />
          </Button>
          <Button
            variant="ghost" size="icon"
            className="h-10 w-10 text-foreground active:scale-90 transition-transform"
            onClick={isPlaying ? pause : resume}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying
              ? <Pause className="h-4 w-4 fill-current" />
              : <Play  className="h-4 w-4 fill-current ml-0.5" />
            }
          </Button>
          <Button
            variant="ghost" size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-foreground active:scale-90 transition-transform"
            onClick={skipNext} aria-label="Next"
          >
            <SkipForward className="h-4 w-4 fill-current" />
          </Button>
        </div>
      </div>
    </div>
  );
}
