import React from 'react';
import { usePlayer } from '@/context/AudioPlayerContext';
import {
  ListOrdered, Volume2, X, Shuffle, Repeat, Repeat1, Infinity as InfinityIcon,
  History, Sparkles, Music2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import type { MaplogSong } from '@/lib/types';

function ToggleChip({ active, onClick, icon: Icon, label }: {
  active: boolean; onClick: () => void; icon: React.ElementType; label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition-all border active:scale-95',
        active
          ? 'bg-primary/15 border-primary/40 text-primary shadow-[0_0_16px_rgba(255,60,0,0.15)]'
          : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10',
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function SectionLabel({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-3 pt-5 pb-2">
      <Icon className="w-3.5 h-3.5 text-white/40" />
      <span className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">{children}</span>
    </div>
  );
}

function SongRow({ song, index, leading, muted, onClick, active, isPlaying }: {
  song: MaplogSong;
  index?: number;
  leading?: React.ReactNode;
  muted?: boolean;
  onClick?: () => void;
  active?: boolean;
  isPlaying?: boolean;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index ?? 0, 10) * 0.03 }}
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'flex items-center gap-4 px-3 py-3 rounded-2xl transition-colors w-full text-left',
        active ? 'bg-primary/10 border border-primary/20' : onClick ? 'hover:bg-white/5 active:bg-white/10' : '',
        muted ? 'opacity-60' : '',
      )}>
      <div className={cn(
        'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner overflow-hidden',
        active ? 'bg-primary text-white' : 'bg-white/5 text-white/40',
      )}>
        {leading ?? (song.artworkUrl
          ? <img src={song.artworkUrl} alt="" className="w-full h-full object-cover" />
          : <Music2 className="h-4 w-4" />)}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-[15px] font-bold truncate leading-tight', active ? 'text-white' : 'text-white/80')}>
          {song.title}
        </p>
        <p className="text-xs text-white/50 truncate mt-0.5">{song.artist}</p>
      </div>
      {active && isPlaying && (
        <div className="shrink-0 flex items-end gap-[3px] h-4">
          {[0, 1, 2, 3].map(j => (
            <div key={j}
              className="w-1 bg-primary rounded-full animate-[bounce_0.8s_ease-in-out_infinite]"
              style={{ height: `${8 + j * 3}px`, animationDelay: `${j * 0.15}s` }}
            />
          ))}
        </div>
      )}
    </motion.button>
  );
}

export function QueueSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {
    queue, queueIndex, currentSong, isPlaying, play, history, autoplayNext,
    shuffle, repeat, autoplay, toggleShuffle, cycleRepeat, toggleAutoplay,
  } = usePlayer();

  const RepeatIcon = repeat === 'one' ? Repeat1 : Repeat;
  const repeatLabel = repeat === 'off' ? 'Repeat' : repeat === 'all' ? 'Repeat All' : 'Repeat One';

  // Only songs still ahead of the playhead count as "queued"
  const upcoming = queue.slice(queueIndex + 1);
  const showAutoplayNext = upcoming.length === 0 && autoplay && repeat !== 'all' && !!autoplayNext && !!currentSong;
  const recent = history.filter(s => s.id !== currentSong?.id);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0, transition: { type: "spring", damping: 30, stiffness: 300 } }}
          exit={{ y: "100%", transition: { duration: 0.25, ease: [0.4, 0, 1, 1] } }}
          className="absolute inset-0 z-50 bg-background flex flex-col will-change-transform"
        >
          <div className="flex justify-between items-center px-6 pt-12 pb-3 shrink-0">
            <div>
              <h3 className="text-2xl font-display font-bold text-white">Up Next</h3>
              <p className="text-primary font-medium text-sm mt-0.5">
                {upcoming.length} song{upcoming.length !== 1 ? 's' : ''} in queue
              </p>
            </div>
            <Button variant="ghost" size="icon"
              className="rounded-full bg-white/5 hover:bg-white/10 text-white"
              onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex items-center gap-2 px-6 pb-4 shrink-0 border-b border-white/5 overflow-x-auto">
            <ToggleChip active={shuffle} onClick={toggleShuffle} icon={Shuffle} label="Shuffle" />
            <ToggleChip active={repeat !== 'off'} onClick={cycleRepeat} icon={RepeatIcon} label={repeatLabel} />
            <ToggleChip active={autoplay} onClick={toggleAutoplay} icon={InfinityIcon} label="Autoplay" />
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-6 min-h-0">
            {/* Now playing */}
            {currentSong && (
              <>
                <SectionLabel icon={Volume2}>Now Playing</SectionLabel>
                <SongRow
                  song={currentSong}
                  active
                  isPlaying={isPlaying}
                  leading={<Volume2 className="h-5 w-5" />}
                />
              </>
            )}

            {/* Queued songs */}
            <SectionLabel icon={ListOrdered}>In Queue</SectionLabel>
            {upcoming.length === 0 && !showAutoplayNext ? (
              <p className="px-3 py-4 text-white/35 text-sm font-medium">
                Queue is empty{autoplay ? '' : ' — playback will stop after this song'}.
              </p>
            ) : (
              <div className="space-y-1">
                {upcoming.map((song, i) => (
                  <SongRow
                    key={`${song.id}-${i}`}
                    song={song}
                    index={i}
                    leading={<span className="text-sm font-bold">{i + 1}</span>}
                    onClick={() => play(song)}
                  />
                ))}
                {showAutoplayNext && autoplayNext && (
                  <SongRow
                    song={autoplayNext}
                    muted
                    leading={<Sparkles className="h-4 w-4 text-primary" />}
                    onClick={() => play(autoplayNext)}
                  />
                )}
              </div>
            )}
            {showAutoplayNext && (
              <p className="px-3 pt-1 text-[11px] text-white/30 font-medium">
                Picked by autoplay — plays when the queue ends.
              </p>
            )}

            {/* Recently played */}
            {recent.length > 0 && (
              <>
                <SectionLabel icon={History}>Recently Played</SectionLabel>
                <div className="space-y-1">
                  {recent.map((song, i) => (
                    <SongRow
                      key={`${song.id}-recent-${i}`}
                      song={song}
                      index={i}
                      muted
                      onClick={() => play(song)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
