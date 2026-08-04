import React, { useState } from 'react';
import { useListPlaylists, useCreatePlaylist, useDeletePlaylist, getListPlaylistsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { ListMusic, Plus, Trash2, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

export default function Playlists() {
  const { data: playlists, isLoading } = useListPlaylists();
  const createPlaylist = useCreatePlaylist();
  const deletePlaylist = useDeletePlaylist();
  const queryClient = useQueryClient();

  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleCreate = () => {
    if (!newPlaylistName.trim()) return;
    createPlaylist.mutate({ data: { name: newPlaylistName, description: newPlaylistDesc } }, {
      onSuccess: () => {
        toast.success('Playlist created');
        setNewPlaylistName('');
        setNewPlaylistDesc('');
        setIsDialogOpen(false);
        queryClient.invalidateQueries({ queryKey: getListPlaylistsQueryKey() });
      }
    });
  };

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.preventDefault(); // prevent link click
    if (confirm('Delete this playlist?')) {
      deletePlaylist.mutate({ id }, {
        onSuccess: () => {
          toast.success('Playlist deleted');
          queryClient.invalidateQueries({ queryKey: getListPlaylistsQueryKey() });
        }
      });
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 animate-in fade-in pb-24 sm:pb-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Playlists</h1>
          <p className="text-muted-foreground mt-1">{playlists?.length || 0} playlists</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full gap-2">
              <Plus className="h-4 w-4" />
              New Playlist
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Playlist</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input value={newPlaylistName} onChange={e => setNewPlaylistName(e.target.value)} placeholder="Summer Vibes" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description (Optional)</label>
                <Input value={newPlaylistDesc} onChange={e => setNewPlaylistDesc(e.target.value)} placeholder="My favorite tracks..." />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleCreate} disabled={createPlaylist.isPending || !newPlaylistName.trim()}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-muted-foreground">Loading playlists...</div>
      ) : playlists?.length === 0 ? (
        <div className="text-center py-20 bg-card border border-border border-dashed rounded-xl">
          <ListMusic className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-bold mb-2">No Playlists Yet</h3>
          <p className="text-muted-foreground mb-6">Create a playlist to start organizing your collection.</p>
          <Button onClick={() => setIsDialogOpen(true)}>Create Playlist</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {playlists?.map(p => (
            <Link key={p.id} href={`/playlists/${p.id}`}>
              <div className="group bg-card hover:bg-accent border border-border rounded-xl p-4 sm:p-6 transition-all cursor-pointer relative overflow-hidden card-effect flex items-center gap-4">
                <div className="h-16 w-16 bg-muted rounded-lg flex items-center justify-center shrink-0">
                  <ListMusic className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg truncate group-hover:text-primary transition-colors">{p.name}</h3>
                  <p className="text-sm text-muted-foreground truncate">{p.songCount} {p.songCount === 1 ? 'song' : 'songs'}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={e => e.preventDefault()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={e => e.preventDefault()}>
                    <DropdownMenuItem className="text-destructive" onClick={(e) => handleDelete(p.id, e)}>
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
