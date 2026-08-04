import React, { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useNoScroll } from '@/lib/useNoScroll';
import {
  useGetSong, getGetSongQueryKey, useDeleteSong,
  useListPlaylists, useAddSongToPlaylist,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import useEmblaCarousel from 'embla-carousel-react';
import { SoundmapCard } from '@/components/SoundmapCard';
import { Button } from '@/components/ui/button';
import {
  Play, ArrowLeft, MoreVertical, Plus,
  Trash2, Edit2, ListPlus, ListMusic, ListEnd,
} from 'lucide-react';
import { usePlayer } from '@/context/AudioPlayerContext';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function SongDetail() {
  useNoScroll();
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { play, enqueue } = usePlayer();

  const { data: songDetail, isLoading } = useGetSong(Number(id), {
    query: { enabled: !!id, queryKey: getGetSongQueryKey(Number(id)) },
  });

  const multiCard = (songDetail?.cards?.length ?? 0) > 1;
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, watchDrag: multiCard });
  const [activeSnap, setActiveSnap] = useState(0);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [playlistPickerOpen, setPlaylistPickerOpen] = useState(false);

  const deleteSong = useDeleteSong();
  const { data: playlists } = useListPlaylists();
  const addSongToPlaylist = useAddSongToPlaylist();

  React.useEffect(() => {
    if (emblaApi) {
      emblaApi.on('select', () => setActiveSnap(emblaApi.selectedScrollSnap()));
    }
  }, [emblaApi]);

  const handleDelete = () => {
    if (confirm('Delete this song and all its cards?')) {
      deleteSong.mutate({ id: Number(id) }, {
        onSuccess: () => {
          toast.success('Song deleted');
          queryClient.invalidateQueries({ queryKey: ['/api/songs'] });
          setLocation('/collection');
        },
      });
    }
  };

  const handlePlay = () => {
    if (songDetail) play(songDetail);
  };

  const handleAddToQueue = () => {
    if (songDetail) {
      enqueue(songDetail);
      toast.success('Added to queue');
    }
    setActionsOpen(false);
  };

  const handleAddToPlaylist = (playlistId: number) => {
    addSongToPlaylist.mutate(
      { id: playlistId, data: { songId: Number(id) } },
      {
        onSuccess: () => { toast.success('Added to playlist'); setPlaylistPickerOpen(false); setActionsOpen(false); },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to add to playlist'),
      },
    );
  };

  if (isLoading) return <div className="p-8 text-center animate-pulse">Loading…</div>;
  if (!songDetail) return <div className="p-8 text-center text-muted-foreground">Song not found</div>;

  const cards = songDetail.cards || [];

  return (
    <div className="h-[calc(100dvh-4rem)] sm:h-[100dvh] flex flex-col animate-in fade-in relative">

      {/* Ambient art blur behind everything */}
      {cards[activeSnap]?.artworkUrl && (
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <img
            src={cards[activeSnap].artworkUrl!}
            alt=""
            className="absolute top-0 left-0 w-full h-[50%] object-cover blur-[100px] opacity-20 scale-150 transform-gpu"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
        </div>
      )}

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-5 pb-2 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}
          className="rounded-full bg-card/50 backdrop-blur-sm">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full bg-card/50 backdrop-blur-sm">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => setLocation(`/add?edit=${songDetail.id}`)}>
              <Edit2 className="mr-2 h-4 w-4" /> Edit Song
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={handleDelete}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete Song
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Card carousel — fills available space */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center min-h-0">
        {cards.length > 0 ? (
          <div className="w-full max-w-sm [overflow-x:clip] py-12 px-12" ref={emblaRef}>
            <div className="flex touch-pan-y">
              {cards.map((card, i) => (
                <div key={card.id} className="flex-[0_0_100%] min-w-0 flex justify-center items-center py-2">
                  <SoundmapCard
                    card={card}
                    title={songDetail.title}
                    artist={songDetail.artist}
                    genre={songDetail.genre}
                    size="lg"
                    className={`transition-all duration-300 ${i === activeSnap ? 'scale-100 opacity-100' : 'scale-90 opacity-60'}`}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="w-64 aspect-[2/3] rounded-2xl bg-card border-2 border-dashed border-border flex flex-col items-center justify-center p-6 text-center">
            <Plus className="h-8 w-8 text-muted-foreground mb-4" />
            <p className="font-semibold text-lg mb-2">No Cards</p>
            <p className="text-sm text-muted-foreground">No cards collected for this song yet.</p>
          </div>
        )}

        {/* Carousel dots */}
        {cards.length > 1 && (
          <div className="flex items-center justify-center gap-2 mt-3 shrink-0">
            {cards.map((_, i) => (
              <div key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === activeSnap ? 'w-6 bg-primary' : 'w-1.5 bg-border'}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Action buttons — always visible, no scroll; pb accounts for MiniPlayer height above nav */}
      <div className="relative z-10 shrink-0 flex items-center justify-center gap-5 pb-24 pt-3">
        {/* Play — circular */}
        <button
          onClick={handlePlay}
          className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform"
          aria-label="Play"
        >
          <Play className="w-7 h-7 fill-current ml-0.5" />
        </button>

        {/* Actions — circular, opens sheet */}
        <button
          onClick={() => setActionsOpen(true)}
          className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/15 active:scale-95 transition-all"
          aria-label="More actions"
        >
          <ListPlus className="w-5 h-5" />
        </button>
      </div>

      {/* Hidden metadata — available for other uses */}
      <div hidden aria-hidden>
        <span data-title>{songDetail.title}</span>
        <span data-artist>{songDetail.artist}</span>
        <span data-album>{songDetail.album}</span>
      </div>

      {/* ── Actions sheet ─────────────────────────────────────────────────── */}
      <Dialog open={actionsOpen} onOpenChange={setActionsOpen}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">{songDetail.title}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 pb-2">
            <button
              onClick={handleAddToQueue}
              className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/8 transition-colors text-left w-full"
            >
              <ListEnd className="w-5 h-5 text-muted-foreground shrink-0" />
              <span className="font-semibold">Add to Queue</span>
            </button>

            <button
              onClick={() => { setPlaylistPickerOpen(true); }}
              className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/8 transition-colors text-left w-full"
            >
              <ListPlus className="w-5 h-5 text-muted-foreground shrink-0" />
              <span className="font-semibold">Add to Playlist</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Playlist picker ───────────────────────────────────────────────── */}
      <Dialog open={playlistPickerOpen} onOpenChange={setPlaylistPickerOpen}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Add to Playlist</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2">
            {!playlists?.length ? (
              <p className="text-center text-muted-foreground py-4 text-sm">
                No playlists yet. Create one in the Playlists tab.
              </p>
            ) : (
              playlists.map(p => (
                <button key={p.id}
                  onClick={() => handleAddToPlaylist(p.id)}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/8 transition-colors text-left w-full"
                >
                  <ListMusic className="w-5 h-5 text-muted-foreground shrink-0" />
                  <span className="font-semibold">{p.name}</span>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
