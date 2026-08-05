import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useMusicKit } from '@/context/MusicKitContext';
import { usePlayer } from '@/context/AudioPlayerContext';
import useEmblaCarousel from 'embla-carousel-react';
import { SoundmapCard } from '@/components/SoundmapCard';
import { Button } from '@/components/ui/button';
import { Play, ArrowLeft, MoreVertical, ListEnd, Trash2, Disc3 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function SongDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { getSong, songs, removeFromCollection } = useMusicKit();
  const { play, enqueue } = usePlayer();

  const songId = decodeURIComponent(id ?? '');
  const song = getSong(songId);

  const multiCard = (song?.cards?.length ?? 0) > 1;
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, watchDrag: multiCard });
  const [activeSnap, setActiveSnap] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (emblaApi) emblaApi.on('select', () => setActiveSnap(emblaApi.selectedScrollSnap()));
  }, [emblaApi]);

  const handlePlay = () => {
    if (song) { play(song, songs); setLocation('/'); }
  };

  const handleAddToQueue = () => {
    if (song) { enqueue(song); toast.success('Added to queue'); }
    setMenuOpen(false);
  };

  const handleRemove = () => {
    if (!song) return;
    if (!confirm(`Remove "${song.title}" from your collection?`)) return;
    removeFromCollection(song.id);
    toast.success('Removed from collection');
    setMenuOpen(false);
    setLocation('/collection');
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
    <div className="h-full flex flex-col overflow-hidden relative bg-background">
      <AnimatePresence>
        {activeCard?.artworkUrl && (
          <motion.div 
            key={activeCard.artworkUrl}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 z-0 pointer-events-none overflow-hidden"
          >
            <img
              src={activeCard.artworkUrl}
              alt=""
              className="absolute top-0 left-0 w-full h-[60%] object-cover blur-[80px] scale-150 transform-gpu"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background to-background" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 flex items-center justify-between px-5 pt-8 pb-4 shrink-0">
        <Button
          variant="ghost" size="icon"
          onClick={() => { if (window.history.length > 1) window.history.back(); else setLocation('/collection'); }}
          className="rounded-full glass-panel hover:bg-white/10 active:scale-90 transition-all text-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-black tracking-widest uppercase text-white/50">Detail</span>
        </div>
        <Button
          variant="ghost" size="icon"
          onClick={() => setMenuOpen(true)}
          className="rounded-full glass-panel hover:bg-white/10 active:scale-90 transition-all text-white"
        >
          <MoreVertical className="h-5 w-5" />
        </Button>
      </div>

      <div className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center px-4">
        {cards.length > 0 ? (
          <div className="w-full flex flex-col items-center">
            <div className="w-full max-w-[400px] [overflow-x:clip] py-6 px-4" ref={emblaRef}>
              <div className="flex touch-pan-y items-center">
                {cards.map((card, i) => (
                  <div key={card.id} className="flex-[0_0_100%] min-w-0 flex justify-center items-center perspective-[1000px]">
                    <motion.div
                      animate={{ 
                        scale: i === activeSnap ? 1 : 0.85,
                        opacity: i === activeSnap ? 1 : 0.4,
                        rotateY: i === activeSnap ? 0 : (i < activeSnap ? 15 : -15),
                      }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
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
                  </div>
                ))}
              </div>
            </div>
            
            <div className="h-10 mt-4 flex items-center justify-center">
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
      </div>

      <div className="relative z-10 text-center px-6 py-4 shrink-0">
        <motion.p 
          key={`title-${song.id}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display font-black text-2xl text-white leading-tight truncate"
        >
          {song.title}
        </motion.p>
        <motion.p 
          key={`artist-${song.id}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-base text-primary font-semibold truncate mt-1"
        >
          {song.artist}
        </motion.p>
        
        <div className="flex justify-center mt-4 h-6">
          <AnimatePresence mode="wait">
            {activeCard && (
              <motion.p 
                key={activeCard.rarityType.name}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="text-xs text-white/50 font-bold tracking-[0.2em] uppercase bg-white/5 px-4 py-1.5 rounded-full border border-white/10"
              >
                {activeCard.rarityType.name} Tier
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="relative z-10 shrink-0 flex items-center justify-center gap-6 pb-8 pt-4">
        <button
          onClick={handlePlay}
          className="w-20 h-20 rounded-full bg-primary text-white flex items-center justify-center shadow-[0_0_30px_rgba(255,60,0,0.4)] hover:scale-105 hover:bg-primary/90 active:scale-95 transition-all group"
          aria-label="Play"
        >
          <Play className="w-8 h-8 fill-current ml-1 group-hover:scale-110 transition-transform" />
        </button>
        <button
          onClick={handleAddToQueue}
          className="w-14 h-14 rounded-full glass-panel flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all text-white/80"
          aria-label="Add to queue"
        >
          <ListEnd className="w-6 h-6" />
        </button>
      </div>

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent className="sm:max-w-sm rounded-[2rem] bg-card border border-white/10 p-6">
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
            <button
              onClick={handleRemove}
              className="flex items-center gap-4 px-4 py-4 rounded-2xl bg-destructive/5 hover:bg-destructive/15 transition-colors text-left w-full group text-destructive"
            >
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <span className="font-semibold">Remove from Collection</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
