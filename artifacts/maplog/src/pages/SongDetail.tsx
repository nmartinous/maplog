import React, { useState } from 'react';
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

  React.useEffect(() => {
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

  // ── Not found ───────────────────────────────────────────────────────────────
  if (!song) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <Disc3 className="w-10 h-10 opacity-30" />
        <p className="text-sm">Song not found</p>
        <Button variant="ghost" size="sm" onClick={() => setLocation('/collection')}>
          Back to Collection
        </Button>
      </div>
    );
  }

  const cards = song.cards;
  const activeCard = cards[activeSnap];

  return (
    // h-full fills exactly the shell's available viewport — no chrome overlap
    <div className="h-full flex flex-col overflow-hidden relative">

      {/* Ambient art blur */}
      {activeCard?.artworkUrl && (
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <img
            src={activeCard.artworkUrl}
            alt=""
            className="absolute top-0 left-0 w-full h-[55%] object-cover blur-[80px] opacity-25 scale-150 transform-gpu"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
        </div>
      )}

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-5 pb-2 shrink-0">
        <Button
          variant="ghost" size="icon"
          onClick={() => { if (window.history.length > 1) window.history.back(); else setLocation('/collection'); }}
          className="rounded-full bg-card/50 backdrop-blur-sm active:scale-90 transition-transform"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost" size="icon"
          onClick={() => setMenuOpen(true)}
          className="rounded-full bg-card/50 backdrop-blur-sm active:scale-90 transition-transform"
        >
          <MoreVertical className="h-5 w-5" />
        </Button>
      </div>

      {/* Card carousel — flex-1 fills remaining space */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center">
        {cards.length > 0 ? (
          <>
            <div className="w-full max-w-sm [overflow-x:clip] py-4 px-10" ref={emblaRef}>
              <div className="flex touch-pan-y">
                {cards.map((card, i) => (
                  <div key={card.id} className="flex-[0_0_100%] min-w-0 flex justify-center items-center py-2">
                    <SoundmapCard
                      card={card}
                      title={song.title}
                      artist={song.artist}
                      genre={song.genre}
                      size="lg"
                      className={cn(
                        'transition-all duration-300',
                        i === activeSnap ? 'scale-100 opacity-100' : 'scale-90 opacity-50',
                      )}
                    />
                  </div>
                ))}
              </div>
            </div>

            {cards.length > 1 && (
              <div className="flex items-center justify-center gap-2 shrink-0 mt-1">
                {cards.map((_, i) => (
                  <div key={i}
                    className={cn(
                      'h-1.5 rounded-full transition-all duration-300',
                      i === activeSnap ? 'w-6 bg-primary' : 'w-1.5 bg-border',
                    )}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="w-56 aspect-[2/3] rounded-2xl bg-card border-2 border-dashed border-border flex flex-col items-center justify-center p-6 text-center">
            <Disc3 className="h-10 w-10 text-muted-foreground/30 mb-4" />
            <p className="font-semibold text-lg mb-1">No Cards</p>
            <p className="text-sm text-muted-foreground">No cards collected yet.</p>
          </div>
        )}
      </div>

      {/* Song info */}
      <div className="relative z-10 text-center px-6 py-3 shrink-0">
        <p className="font-extrabold text-base leading-tight truncate">{song.title}</p>
        <p className="text-sm text-muted-foreground truncate mt-0.5">{song.artist}</p>
        {activeCard && (
          <p className="text-xs text-primary/70 font-bold tracking-widest uppercase mt-1.5">
            {activeCard.rarityType.name}
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className="relative z-10 shrink-0 flex items-center justify-center gap-5 pb-5 pt-2">
        <button
          onClick={handlePlay}
          className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-transform"
          aria-label="Play"
        >
          <Play className="w-7 h-7 fill-current ml-0.5" />
        </button>
        <button
          onClick={handleAddToQueue}
          className="w-12 h-12 rounded-full bg-white/10 border border-white/15 flex items-center justify-center hover:bg-white/15 active:scale-95 transition-all"
          aria-label="Add to queue"
        >
          <ListEnd className="w-5 h-5" />
        </button>
      </div>

      {/* ⋯ Menu */}
      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold truncate">{song.title}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-0.5 pb-2">
            <button
              onClick={handleAddToQueue}
              className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/8 transition-colors text-left w-full"
            >
              <ListEnd className="w-5 h-5 text-muted-foreground shrink-0" />
              <span className="font-semibold text-sm">Add to Queue</span>
            </button>
            <button
              onClick={handleRemove}
              className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-destructive/10 transition-colors text-left w-full text-destructive"
            >
              <Trash2 className="w-5 h-5 shrink-0" />
              <span className="font-semibold text-sm">Remove from Collection</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
