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

// In-flow element: shrink-0 keeps it at a fixed height inside the flex column.
// No position:fixed — the shell layout places it directly above the mobile nav.
// On short viewports (landscape phone) the player collapses to a compact 40px strip.
const BASE = 'shrink-0 h-16 landscape-compact:h-10 bg-card/92 backdrop-blur-xl border-t border-white/8';

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
            <div className="w-7 h-7 landscape-compact:w-6 landscape-compact:h-6 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Music2 className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm landscape-compact:text-xs font-semibold">Nothing playing</p>
              <p className="text-xs landscape-compact:hidden text-muted-foreground">Tap a card to play</p>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-15 pointer-events-none">
            <div className="h-7 w-7 landscape-compact:h-6 landscape-compact:w-6" />
            <div className="h-7 w-7 landscape-compact:h-6 landscape-compact:w-6 flex items-center justify-center">
              <Play className="h-3.5 w-3.5 ml-0.5" />
            </div>
            <div className="h-7 w-7 landscape-compact:h-6 landscape-compact:w-6 flex items-center justify-center">
              <SkipForward className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Active ─────────────────────────────────────────────────────────────────
  return (
    <div className={BASE + ' flex flex-col'}>
      {/* Scrubber — hidden in compact mode to save space */}
      <div
        ref={barRef}
        className="w-full h-[3px] landscape-compact:h-[2px] bg-white/10 cursor-pointer group relative shrink-0"
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
          <div className="w-7 h-7 landscape-compact:w-6 landscape-compact:h-6 rounded-md bg-muted overflow-hidden">
            {currentSong.artworkUrl
              ? <img src={currentSong.artworkUrl} alt={currentSong.title} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center"><Music2 className="w-3.5 h-3.5 text-muted-foreground" /></div>
            }
          </div>
        </Link>

        {/* Title + time → full player */}
        <Link href="/" className="flex-1 min-w-0 cursor-pointer active:opacity-70 transition-opacity">
          <p className="text-sm landscape-compact:text-xs font-bold truncate leading-tight">{currentSong.title}</p>
          <p className="text-[11px] landscape-compact:hidden text-muted-foreground truncate leading-tight">
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
            className="h-7 w-7 landscape-compact:h-6 landscape-compact:w-6 text-muted-foreground hover:text-foreground active:scale-90 transition-transform"
            onClick={skipPrev} aria-label="Previous"
          >
            <SkipBack className="h-3.5 w-3.5 fill-current" />
          </Button>
          <Button
            variant="ghost" size="icon"
            className="h-8 w-8 landscape-compact:h-7 landscape-compact:w-7 text-foreground active:scale-90 transition-transform"
            onClick={isPlaying ? pause : resume}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying
              ? <Pause className="h-3.5 w-3.5 fill-current" />
              : <Play  className="h-3.5 w-3.5 fill-current ml-0.5" />
            }
          </Button>
          <Button
            variant="ghost" size="icon"
            className="h-7 w-7 landscape-compact:h-6 landscape-compact:w-6 text-muted-foreground hover:text-foreground active:scale-90 transition-transform"
            onClick={skipNext} aria-label="Next"
          >
            <SkipForward className="h-3.5 w-3.5 fill-current" />
          </Button>
        </div>
      </div>
    </div>
  );
}
