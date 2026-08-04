import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'wouter';
import { useGetPlaylist, useRemoveSongFromPlaylist, getGetPlaylistQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { usePlayer } from '@/context/AudioPlayerContext';
import { Button } from '@/components/ui/button';
import { Play, ArrowLeft, Trash2, GripVertical, ListMusic } from 'lucide-react';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableSongItem({ song, onRemove }: { song: any, onRemove: (id: number) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: song.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={`flex items-center gap-4 p-3 bg-card border border-border rounded-lg group ${isDragging ? 'shadow-lg ring-2 ring-primary/50' : 'hover:bg-accent'}`}>
      <div {...attributes} {...listeners} className="cursor-grab p-1 text-muted-foreground hover:text-foreground">
        <GripVertical className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-sm truncate">{song.title}</h4>
        <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
      </div>
      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onRemove(song.id)}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function PlaylistDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { play } = usePlayer();
  const [songs, setSongs] = useState<any[]>([]);

  const { data: playlist, isLoading } = useGetPlaylist(Number(id), {
    query: { enabled: !!id, queryKey: getGetPlaylistQueryKey(Number(id)) }
  });

  const removeSong = useRemoveSongFromPlaylist();

  useEffect(() => {
    if (playlist?.songs) {
      setSongs(playlist.songs);
    }
  }, [playlist?.songs]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSongs((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
      // Note: Reordering is client-side only as there is no API endpoint for updating order
    }
  };

  const handleRemove = (songId: number) => {
    removeSong.mutate({ id: Number(id), songId }, {
      onSuccess: () => {
        toast.success('Song removed');
        queryClient.invalidateQueries({ queryKey: getGetPlaylistQueryKey(Number(id)) });
      }
    });
  };

  const handlePlayAll = () => {
    if (songs.length > 0) {
      play(songs[0], songs);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  if (!playlist) return <div className="p-8 text-center text-muted-foreground">Playlist not found</div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 animate-in fade-in pb-24 sm:pb-8">
      <div className="flex items-center gap-4">
        <Link href="/playlists">
          <Button variant="ghost" size="icon" className="rounded-full bg-card/50">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-extrabold tracking-tight truncate">{playlist.name}</h1>
          <p className="text-muted-foreground">{playlist.description}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="font-medium">{songs.length} {songs.length === 1 ? 'song' : 'songs'}</p>
        <Button onClick={handlePlayAll} disabled={songs.length === 0} className="rounded-full gap-2 font-bold px-6">
          <Play className="h-4 w-4 fill-current" />
          Play All
        </Button>
      </div>

      {songs.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={songs.map(s => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {songs.map(song => (
                <SortableSongItem key={song.id} song={song} onRemove={handleRemove} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="text-center py-20 bg-card border border-border border-dashed rounded-xl">
          <ListMusic className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-bold mb-2">Playlist is empty</h3>
          <p className="text-muted-foreground mb-6">Go to a song's detail page to add it to this playlist.</p>
          <Link href="/collection">
            <Button variant="outline">Browse Collection</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
