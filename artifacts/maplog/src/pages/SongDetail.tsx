import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useLocation } from 'wouter';
import { useMusicKit } from '@/context/MusicKitContext';
import { readCollectionFilter, applyCollectionFilter, isFilterActive } from '@/lib/collectionFilter';
import { usePlayer } from '@/context/AudioPlayerContext';
import useEmblaCarousel from 'embla-carousel-react';
import { SoundmapCard } from '@/components/SoundmapCard';
import { CardBackInfo } from '@/components/CardBackInfo';
import { QueueSheet } from '@/components/QueueSheet';
import { Button } from '@/components/ui/button';
import { Play, ArrowLeft, MoreVertical, Disc3, ListEnd, Info, ListOrdered } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function SongDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { getSong, songs: allSongs } = useMusicKit();
  const { play, resume, enqueue, currentSong, isPlaying } = usePlayer();

  const songId = decodeURIComponent(id ?? '');
  // Fall back to the actively playing song so the mini player can always
  // open a card view, even for songs not (or no longer) in the collection.
  const song = getSong(songId) ?? (currentSong?.id === songId ? currentSong : undefined);
  const isCurrent = currentSong?.id === song?.id;

  const multiCard = (song?.cards?.length ?? 0) > 1;
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, watchDrag: multiCard });
  const [activeSnap, setActiveSnap] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setActiveSnap(emblaApi.selectedScrollSnap());
    emblaApi.on('select', onSelect);
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi]);

  useEffect(() => { setIsFlipped(false); }, [activeSnap, song?.id]);

  // ── Filter-aware vertical swipe navigation (TikTok-style) ──────────────────
  // The collection grid saves its active filter to sessionStorage; a vertical
  // swipe here moves to the prev/next song in that filtered list.
  const [cvFilter] = useState(readCollectionFilter);
  const filteredSongs = useMemo(
    () => applyCollectionFilter(allSongs, cvFilter),
    [allSongs, cvFilter],
  );
  const hasFilterActive = isFilterActive(cvFilter);

  /** Set when a qualifying swipe fired — suppresses the synthetic click. */
  const swipedRef = useRef(false);
  /** Pans starting inside a RadiantSpin surface belong to drag-to-spin. */
  const ignorePanRef = useRef(false);

  const goToFiltered = useCallback((delta: number) => {
    const list = filteredSongs;
    const idx = list.findIndex(s => s.id === songId);
    if (idx < 0) return;
    const next = list[idx + delta];
    if (!next) return;
    setLocation(`/song/${encodeURIComponent(next.id)}`, { replace: true });
  }, [filteredSongs, songId, setLocation]);

  const onZonePanStart = useCallback((e: PointerEvent | MouseEvent | TouchEvent) => {
    swipedRef.current = false;
    const target = e.target as HTMLElement | null;
    ignorePanRef.current = !!target?.closest?.('[data-radiant-spin]');
  }, []);

  const onZonePanEnd = useCallback((_: unknown, info: { offset: { x: number; y: number } }) => {
    if (ignorePanRef.current) { ignorePanRef.current = false; return; }
    const dy = info.offset.y;
    const dx = info.offset.x;
    // Predominantly vertical swipe → prev/next in the active filter.
    // Horizontal stays with embla (multi-card browsing).
    if (Math.abs(dy) >= 40 && Math.abs(dx) <= Math.abs(dy) * 0.8) {
      swipedRef.current = true;
      goToFiltered(dy < 0 ? 1 : -1); // swipe up = forward
    }
  }, [goToFiltered]);

  const onZoneClickCapture = useCallback((e: React.MouseEvent) => {
    if (swipedRef.current) {
      swipedRef.current = false;
      e.stopPropagation();
    }
  }, []);

  // Tapping the card starts playback but never pauses it — pausing lives in
  // the mini player controls.
  const handleCardTap = () => {
    if (!song) return;
    if (isCurrent) { if (!isPlaying) resume(); return; }
    // Playing a single song never queues the rest of the collection —
    // autoplay decides what comes next.
    play(song, [song]);
  };

  const handleAddToQueue = () => {
    if (song) { enqueue(song); toast.success('Added to queue'); }
    setMenuOpen(false);
  };

  if (!song) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-white/50 bg-background">
        <Disc3 className="w-16 h-16 opacity-20" />
        <p className="text-lg font-bold text-white/70">Song not found</p>
        <Button variant="secondary" className="rounded-full" onClick={() => setLocation('/collection')}>
          Back to Collection
        </Button>
      </div>
    );
  }

  const cards = song.cards;
  const activeCard = cards[activeSnap];

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
      className="h-full flex flex-col overflow-hidden relative bg-background w-full"
    >
      <AnimatePresence>
        {activeCard?.artworkUrl && (
          <motion.div 
            key={activeCard.artworkUrl}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.38 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.85 }}
            className="absolute inset-0 z-0 pointer-events-none overflow-hidden"
          >
            <img
              src={activeCard.artworkUrl}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover blur-[90px] scale-150 transform-gpu"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/50 to-background" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="page-top relative z-50 flex items-center justify-between px-5 pb-2 shrink-0 pointer-events-auto gap-2">
        <Button
          variant="ghost" size="icon"
          onClick={() => { if (window.history.length > 1) window.history.back(); else setLocation('/collection'); }}
          className="w-11 h-11 rounded-full glass-panel hover:bg-white/10 active:scale-90 transition-all text-white shadow-lg"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        {isCurrent && (
          <div className="flex flex-col items-center min-w-0">
            <span className="text-[9px] font-black tracking-[0.25em] uppercase text-primary">Now Playing</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon"
            className={cn(
              'w-11 h-11 rounded-full glass-panel transition-colors shadow-lg active:scale-90',
              isFlipped ? 'bg-white/20 text-primary border-primary/50' : 'hover:bg-white/10 text-white/80'
            )}
            onClick={() => setIsFlipped(f => !f)} aria-label="Card info">
            <Info className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon"
            className="w-11 h-11 rounded-full glass-panel hover:bg-white/10 transition-colors active:scale-90 shadow-lg"
            onClick={() => setIsQueueOpen(true)} aria-label="Queue">
            <ListOrdered className="h-5 w-5 text-white/80" />
          </Button>
          <Button
            variant="ghost" size="icon"
            onClick={() => setMenuOpen(true)}
            className="w-11 h-11 rounded-full glass-panel hover:bg-white/10 active:scale-90 transition-all text-white shadow-lg"
            aria-label="More options"
          >
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <motion.div
        className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center px-4 w-full"
        style={{ touchAction: 'none' }}
        onPanStart={onZonePanStart}
        onPanEnd={onZonePanEnd}
        onClickCapture={onZoneClickCapture}
      >
        {cards.length > 0 ? (
          <div className="w-full flex flex-col items-center h-full justify-center">
            <div className="w-full max-w-[400px] overflow-visible py-4 px-4 flex-1 flex flex-col justify-center" ref={emblaRef}>
              <div className="flex touch-pan-y items-center overflow-visible">
                {cards.map((card, i) => (
                  <div key={card.id} className="flex-[0_0_100%] min-w-0 flex justify-center items-center perspective-[1000px]">
                    <motion.div
                      animate={{ 
                        scale: i === activeSnap ? (isFlipped ? 1.05 : 1) : 0.85,
                        opacity: i === activeSnap ? 1 : 0.4,
                        rotateX: isFlipped && i === activeSnap ? 180 : 0,
                        rotateY: i === activeSnap ? 0 : (i < activeSnap ? 15 : -15),
                      }}
                      transition={{ type: "spring", stiffness: 260, damping: 25 }}
                      className="relative"
                      style={{ transformStyle: 'preserve-3d', zIndex: i === activeSnap ? 50 : 0, touchAction: 'pan-x' }}
                    >
                      <div className="cursor-pointer group" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }} onClick={handleCardTap}>
                        <SoundmapCard
                          card={card}
                          title={song.title}
                          artist={song.artist}
                          genre={song.genre}
                          size="lg"
                          className="shadow-2xl"
                          onArtistClick={() => setLocation(`/artists/${encodeURIComponent(song.artist)}`)}
                        />
                        {!isFlipped && !(isCurrent && isPlaying) && (
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center z-20 backdrop-blur-sm rounded-2xl pointer-events-none">
                            <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center shadow-[0_0_40px_rgba(255,60,0,0.6)] scale-75 group-hover:scale-100 transition-transform duration-300">
                              <Play className="w-10 h-10 text-white fill-white ml-1.5" />
                            </div>
                          </div>
                        )}
                      </div>
                      <div 
                        className="absolute inset-0 rounded-[1.5rem] sm:rounded-[2rem] glass-panel bg-card/95 backdrop-blur-xl border border-white/20 shadow-2xl overflow-hidden pointer-events-none"
                        style={{ 
                          backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                          transform: 'rotateX(180deg)' 
                        }}
                      >
                        <CardBackInfo trackId={song.id} song={song} />
                      </div>
                    </motion.div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="h-10 mt-1 mb-1 flex items-center justify-center shrink-0">
              {cards.length > 1 && (
                <div className="flex items-center gap-2 bg-black/20 backdrop-blur-xl px-4 py-2 rounded-full border border-white/5">
                  {cards.map((_, i) => (
                    <button key={i} onClick={() => emblaApi?.scrollTo(i)} className="group py-2">
                      <div className={cn(
                        'h-1.5 rounded-full transition-all duration-300',
                        i === activeSnap ? 'w-6 bg-primary shadow-[0_0_10px_rgba(255,60,0,0.5)]' : 'w-1.5 bg-white/20 group-hover:bg-white/40',
                      )} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="w-64 aspect-[2/3] rounded-3xl glass-panel border border-white/10 flex flex-col items-center justify-center p-6 text-center">
            <Disc3 className="h-12 w-12 text-white/20 mb-4" />
            <p className="font-display font-bold text-xl mb-1 text-white">No Cards</p>
            <p className="text-sm text-white/50">You don't own any cards for this song.</p>
          </div>
        )}
      </motion.div>

      <QueueSheet open={isQueueOpen} onClose={() => setIsQueueOpen(false)} />

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent className="sm:max-w-sm rounded-[2rem] bg-card border border-white/10 p-6 z-50">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-display font-bold text-white truncate">{song.title}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <button
              onClick={handleAddToQueue}
              className="flex items-center gap-4 px-4 py-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors text-left w-full group"
            >
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <ListEnd className="w-5 h-5 text-white group-hover:text-primary transition-colors" />
              </div>
              <span className="font-semibold text-white">Add to Queue</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
