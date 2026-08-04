import React, { useState } from 'react';
import { useParams, Link, useLocation } from 'wouter';
import { useGetSong, getGetSongQueryKey, useDeleteSong, useListPlaylists, useAddSongToPlaylist } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import useEmblaCarousel from 'embla-carousel-react';
import { SoundmapCard } from '@/components/SoundmapCard';
import { Button } from '@/components/ui/button';
import { Play, ArrowLeft, MoreVertical, Plus, Trash2, Edit2, ListPlus, ListMusic } from 'lucide-react';
import { usePlayer } from '@/context/AudioPlayerContext';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function SongDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { play } = usePlayer();
  
  const { data: songDetail, isLoading } = useGetSong(Number(id), { 
    query: { enabled: !!id, queryKey: getGetSongQueryKey(Number(id)) }
  });

  // Carousel only interactive when song has multiple collected cards
  const multiCard = (songDetail?.cards?.length ?? 0) > 1;
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, watchDrag: true });
  const [activeSnap, setActiveSnap] = useState(0);
  
  const deleteSong = useDeleteSong();
  const { data: playlists } = useListPlaylists();
  const addSongToPlaylist = useAddSongToPlaylist();

  React.useEffect(() => {
    if (emblaApi) {
      emblaApi.on('select', () => {
        setActiveSnap(emblaApi.selectedScrollSnap());
      });
    }
  }, [emblaApi]);

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this song and all its cards?')) {
      deleteSong.mutate({ id: Number(id) }, {
        onSuccess: () => {
          toast.success('Song deleted');
          queryClient.invalidateQueries({ queryKey: ['/api/songs'] });
          setLocation('/collection');
        }
      });
    }
  };

  const handlePlay = () => {
    if (songDetail) {
      play(songDetail);
    }
  };

  const handleAddToPlaylist = (playlistId: number) => {
    addSongToPlaylist.mutate({ id: playlistId, data: { songId: Number(id) } }, {
      onSuccess: () => {
        toast.success('Added to playlist');
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.message || 'Failed to add to playlist');
      }
    });
  };

  if (isLoading) {
    return <div className="p-8 animate-pulse text-center">Loading song...</div>;
  }

  if (!songDetail) {
    return <div className="p-8 text-center text-muted-foreground">Song not found</div>;
  }

  const cards = songDetail.cards || [];

  return (
    <div className="pb-24 sm:pb-8 animate-in fade-in relative">
      {/* Background Blur */}
      {cards[activeSnap]?.artworkUrl && (
        <div className="absolute top-0 left-0 right-0 h-[400px] z-0 overflow-hidden pointer-events-none">
          <img 
            src={cards[activeSnap].artworkUrl!} 
            alt="" 
            className="w-full h-full object-cover blur-[80px] opacity-30 scale-150 transform-gpu" 
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
        </div>
      )}

      <div className="relative z-10 px-4 sm:px-6 lg:px-8 pt-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()} className="rounded-full bg-card/50 backdrop-blur-sm">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex gap-2">
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
        </div>

        {/* Carousel */}
        <div className="max-w-md mx-auto">
          {cards.length > 0 ? (
            <div className="overflow-hidden" ref={emblaRef}>
              <div className="flex touch-pan-y py-4">
                {cards.map((card, i) => (
                  <div key={card.id} className="flex-[0_0_100%] min-w-0 flex justify-center items-center">
                    <SoundmapCard 
                      card={card} 
                      title={songDetail.title} 
                      artist={songDetail.artist} 
                      size="lg"
                      className={`transition-all duration-300 ${i === activeSnap ? 'scale-100 opacity-100' : 'scale-90 opacity-60'}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="aspect-[2/3] w-64 mx-auto rounded-xl bg-card border-2 border-dashed border-border flex flex-col items-center justify-center p-6 text-center">
              <Plus className="h-8 w-8 text-muted-foreground mb-4" />
              <p className="font-semibold text-lg mb-2">No Cards</p>
              <p className="text-sm text-muted-foreground">You haven't collected any variants of this song yet.</p>
            </div>
          )}

          {/* Dots */}
          {cards.length > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              {cards.map((_, i) => (
                <div 
                  key={i} 
                  className={`h-1.5 rounded-full transition-all duration-300 ${i === activeSnap ? 'w-6 bg-primary' : 'w-1.5 bg-border'}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Metadata & Actions */}
        <div className="max-w-xl mx-auto text-center space-y-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-2">{songDetail.title}</h1>
            <p className="text-xl text-muted-foreground">{songDetail.artist}</p>
            {songDetail.album && (
              <p className="text-sm text-muted-foreground mt-2 font-medium">Album: {songDetail.album}</p>
            )}
          </div>

          <div className="flex items-center justify-center gap-4">
            <Button size="lg" className="rounded-full font-bold px-8 h-14 bg-primary text-primary-foreground hover:scale-105 transition-transform" onClick={handlePlay}>
              <Play className="mr-2 h-6 w-6 fill-current" /> Play Song
            </Button>
            
            <Dialog>
              <DialogTrigger asChild>
                <Button size="lg" variant="outline" className="rounded-full h-14 w-14 p-0">
                  <ListPlus className="h-6 w-6" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add to Playlist</DialogTitle>
                </DialogHeader>
                <div className="grid gap-2 py-4">
                  {playlists?.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">No playlists found. Create one first.</p>
                  )}
                  {playlists?.map(p => (
                    <Button key={p.id} variant="outline" className="justify-start h-12 text-base font-semibold" onClick={() => handleAddToPlaylist(p.id)}>
                      <ListMusic className="mr-3 h-5 w-5 text-muted-foreground" />
                      {p.name}
                    </Button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>


        </div>
      </div>
    </div>
  );
}
