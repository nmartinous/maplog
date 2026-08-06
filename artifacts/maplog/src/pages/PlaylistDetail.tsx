import React, { useMemo, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useMusicKit } from '@/context/MusicKitContext';
import { usePlayer } from '@/context/AudioPlayerContext';
import {
  loadUserPlaylists, saveUserPlaylists, resolveSongs, type UserPlaylist,
} from '@/lib/userPlaylists';
import {
  ArrowLeft, Play, Plus, Music2, Trash2, X, Search, Pencil, Check, ListMusic, Volume2,
} from 'lucide-react';
import { ArtMenu } from '@/components/ArtMenu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function PlaylistDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { songs } = useMusicKit();
  const { play, currentSong, isPlaying } = usePlayer();

  const [lists, setLists] = useState<UserPlaylist[]>(() => loadUserPlaylists());
  const list = lists.find(l => l.id === id);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState(list?.name ?? '');

  const inList = useMemo(() => (list ? resolveSongs(list, songs) : []), [list, songs]);

  const candidates = useMemo(() => {
    if (!list) return [];
    const already = new Set(list.songIds);
    const q = pickerSearch.toLowerCase();
    return songs.filter(s =>
      !already.has(s.id) &&
      (!q || s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)),
    );
  }, [list, songs, pickerSearch]);

  const commit = (next: UserPlaylist[]) => {
    setLists(next);
    saveUserPlaylists(next);
  };

  const update = (patch: Partial<UserPlaylist>) => {
    if (!list) return;
    commit(lists.map(l => (l.id === list.id ? { ...l, ...patch } : l)));
  };

  const handleAdd = (songId: string) => {
    if (!list) return;
    update({ songIds: [...list.songIds, songId] });
  };

  const handleRemove = (songId: string) => {
    if (!list) return;
    update({ songIds: list.songIds.filter(sid => sid !== songId) });
  };

  const handleDelete = () => {
    if (!list) return;
    if (!confirm(`Delete "${list.name}"? Songs stay in your collection.`)) return;
    commit(lists.filter(l => l.id !== list.id));
    setLocation('/playlists');
  };

  const handleRename = () => {
    const name = nameInput.trim();
    if (!name) { setRenaming(false); return; }
    update({ name });
    setRenaming(false);
  };

  if (!list) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-white/50 bg-background">
        <ListMusic className="w-16 h-16 opacity-20" />
        <p className="text-lg font-bold text-white/70">Playlist not found</p>
        <Button variant="secondary" className="rounded-full" onClick={() => setLocation('/playlists')}>
          Back to Playlists
        </Button>
      </div>
    );
  }

  const art = inList.find(s => s.artworkUrl)?.artworkUrl;

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden bg-background pb-20">
      <div className="page-top px-4 sm:px-6 pb-4 flex items-center gap-3">
        <Button
          variant="ghost" size="icon"
          onClick={() => setLocation('/playlists')}
          className="w-11 h-11 rounded-full glass-panel hover:bg-white/10 active:scale-90 transition-all text-white shadow-lg shrink-0"
          aria-label="Back to playlists"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          {renaming ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                className="flex-1 min-w-0 h-11 rounded-2xl bg-white/5 border border-white/10 px-4 text-lg font-display font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false); }}
                maxLength={60}
              />
              <Button size="icon" className="rounded-full w-10 h-10 shrink-0" onClick={handleRename} aria-label="Save name">
                <Check className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <button className="text-left group flex items-center gap-2 min-w-0 w-full" onClick={() => { setNameInput(list.name); setRenaming(true); }}>
              <h1 className="text-2xl font-display font-black tracking-tight text-white truncate">{list.name}</h1>
            </button>
          )}
          <p className="text-xs text-white/50 mt-0.5">{inList.length} song{inList.length !== 1 ? 's' : ''}</p>
        </div>
        <Button
          variant="ghost" size="icon"
          className="w-11 h-11 rounded-full glass-panel text-white/50 hover:text-destructive hover:bg-destructive/10 active:scale-90 transition-all shrink-0"
          onClick={handleDelete} aria-label="Delete playlist"
        >
          <Trash2 className="h-5 w-5" />
        </Button>
      </div>

      <div className="px-4 sm:px-6 pb-5 flex items-center gap-3">
        <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 shadow-lg border border-white/10 bg-white/5">
          {art
            ? <img src={art} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center"><Music2 className="w-7 h-7 text-white/30" /></div>}
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="rounded-full font-bold h-11 px-6 shadow-lg"
            disabled={inList.length === 0}
            onClick={() => play(inList[0], inList)}
          >
            <Play className="w-4 h-4 fill-current mr-2" /> Play
          </Button>
          <Button
            variant="outline"
            className="rounded-full font-bold h-11 px-5 bg-white/5 border-white/10 hover:bg-white/10 text-white"
            onClick={() => { setPickerSearch(''); setPickerOpen(true); }}
          >
            <Plus className="w-4 h-4 mr-1.5" /> Add songs
          </Button>
        </div>
      </div>

      <div className="px-4 sm:px-6 space-y-1">
        {inList.length === 0 ? (
          <div className="text-center pt-12 px-8">
            <Music2 className="w-10 h-10 text-white/15 mx-auto mb-4" />
            <p className="text-sm text-white/50 max-w-[280px] mx-auto leading-relaxed">
              This playlist is empty — tap <span className="text-white font-bold">Add songs</span> to pick from your collection.
            </p>
          </div>
        ) : (
          inList.map((song, i) => {
            const isCurrent = currentSong?.id === song.id;
            return (
              <motion.div
                key={song.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i, 10) * 0.03, duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-colors group',
                  isCurrent ? 'bg-primary/10 border border-primary/20' : 'hover:bg-white/5',
                )}
              >
                <div
                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                  onClick={() => setLocation(`/song/${encodeURIComponent(song.id)}`)}
                  role="button"
                >
                  <ArtMenu song={song} context={inList}>
                    <div className="w-11 h-11 rounded-xl overflow-hidden bg-white/5 shrink-0 relative">
                      {song.artworkUrl
                        ? <img src={song.artworkUrl} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><Music2 className="w-4 h-4 text-white/30" /></div>}
                      {isCurrent && isPlaying && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Volume2 className="w-4 h-4 text-primary" />
                        </div>
                      )}
                    </div>
                  </ArtMenu>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-[15px] font-bold truncate leading-tight', isCurrent ? 'text-primary' : 'text-white')}>{song.title}</p>
                    <button
                      onClick={e => { e.stopPropagation(); setLocation(`/artists/${encodeURIComponent(song.artist)}`); }}
                      className="text-xs text-white/50 truncate mt-0.5 text-left hover:text-white/80 transition-colors w-full"
                    >
                      {song.artist}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(song.id)}
                  className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white/30 hover:text-destructive hover:bg-destructive/10 active:scale-90 transition-all"
                  aria-label={`Remove ${song.title}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })
        )}
      </div>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-md rounded-[2rem] bg-card border border-white/10 p-0 overflow-hidden flex flex-col max-h-[80dvh]">
          <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
            <DialogTitle className="text-xl font-display font-bold text-white">Add songs</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-3 shrink-0 relative">
            <Search className="absolute left-10 top-1/2 -translate-y-[60%] h-4 w-4 text-white/40" />
            <Input
              placeholder="Search your collection…"
              className="pl-11 h-11 bg-white/5 border-white/10 text-white placeholder:text-white/40 rounded-2xl"
              value={pickerSearch}
              onChange={e => setPickerSearch(e.target.value)}
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
            {candidates.length === 0 ? (
              <p className="text-sm text-white/40 text-center py-10">
                {songs.length === 0 ? 'Your collection is empty.' : 'No more songs to add.'}
              </p>
            ) : (
              candidates.map(song => (
                <button
                  key={song.id}
                  onClick={() => { handleAdd(song.id); toast.success(`Added "${song.title}"`); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-white/5 active:bg-white/10 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/5 shrink-0">
                    {song.artworkUrl
                      ? <img src={song.artworkUrl} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><Music2 className="w-4 h-4 text-white/30" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{song.title}</p>
                    <p className="text-xs text-white/50 truncate">{song.artist}</p>
                  </div>
                  <Plus className="w-4 h-4 text-white/40 shrink-0" />
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
