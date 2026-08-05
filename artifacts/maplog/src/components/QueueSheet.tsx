import React from 'react';
import { usePlayer } from '@/context/AudioPlayerContext';
import { ListOrdered, Volume2, X, Shuffle, Repeat, Repeat1, Infinity as InfinityIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

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

export function QueueSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {
    queue, currentSong, isPlaying, play,
    shuffle, repeat, autoplay, toggleShuffle, cycleRepeat, toggleAutoplay,
  } = usePlayer();

  const RepeatIcon = repeat === 'one' ? Repeat1 : Repeat;
  const repeatLabel = repeat === 'off' ? 'Repeat' : repeat === 'all' ? 'Repeat All' : 'Repeat One';

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
                {queue.length} song{queue.length !== 1 ? 's' : ''} in queue
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

          <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
            {queue.length === 0 ? (
              <div className="text-center py-24 flex flex-col items-center">
                <ListOrdered className="w-12 h-12 text-white/10 mb-4" />
                <p className="text-white/40 text-sm font-medium">Your queue is empty</p>
              </div>
            ) : (
              <div className="space-y-1">
                {queue.map((song, i) => {
                  const isCurrent = song.id === currentSong?.id;
                  return (
                    <motion.button 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i, 10) * 0.04 }}
                      key={`${song.id}-${i}`}
                      onClick={() => { if (!isCurrent) play(song); }}
                      className={cn(
                        'flex items-center gap-4 px-3 py-3 rounded-2xl transition-colors w-full text-left',
                        isCurrent ? 'bg-primary/10 border border-primary/20' : 'hover:bg-white/5 active:bg-white/10',
                      )}>
                      <div className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner',
                        isCurrent ? 'bg-primary text-white' : 'bg-white/5 text-white/40',
                      )}>
                        {isCurrent ? <Volume2 className="h-5 w-5" /> : <span className="text-sm font-bold">{i + 1}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-[15px] font-bold truncate leading-tight', isCurrent ? 'text-white' : 'text-white/80')}>
                          {song.title}
                        </p>
                        <p className="text-xs text-white/50 truncate mt-0.5">{song.artist}</p>
                      </div>
                      {isCurrent && isPlaying && (
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
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
