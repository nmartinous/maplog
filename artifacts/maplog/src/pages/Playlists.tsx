import React, { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { useMusicKit } from '@/context/MusicKitContext';
import { usePlayer } from '@/context/AudioPlayerContext';
import {
  loadUserPlaylists, saveUserPlaylists, newPlaylistId, resolveSongs,
  type UserPlaylist,
} from '@/lib/userPlaylists';
import { ListMusic, Play, Plus, Music2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

/**
 * User-created playlists: named lists of songs from the collection.
 * (Rarity ↔ Apple Music playlist syncing lives in Settings.)
 */
export default function Playlists() {
  const { songs } = useMusicKit();
  const { play } = usePlayer();
  const [, setLocation] = useLocation();

  const [lists, setLists] = useState<UserPlaylist[]>(() => loadUserPlaylists());
  const [createOpen, setCreateOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const resolved = useMemo(
    () => lists.map(l => ({ list: l, songs: resolveSongs(l, songs) })),
    [lists, songs],
  );

  const handleCreate = () => {
    const name = nameInput.trim();
    if (!name) return;
    const list: UserPlaylist = { id: newPlaylistId(), name, songIds: [], createdAt: new Date().toISOString() };
    const next = [list, ...lists];
    setLists(next);
    saveUserPlaylists(next);
    setCreateOpen(false);
    setNameInput('');
    setLocation(`/playlists/${list.id}`);
  };

  const handlePlay = (e: React.MouseEvent, songsInList: ReturnType<typeof resolveSongs>) => {
    e.stopPropagation();
    if (songsInList.length === 0) { toast.info('This playlist is empty — add songs first.'); return; }
    play(songsInList[0], songsInList);
  };

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden bg-background pb-20">
      <div className="page-top px-4 sm:px-6 pb-6 relative z-10 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-black tracking-tight text-white">Playlists</h1>
          <p className="text-sm text-white/50 mt-1">Your own mixes from the collection</p>
        </div>
        <Button
          onClick={() => { setNameInput(''); setCreateOpen(true); }}
          className="rounded-full font-bold h-11 px-5 shrink-0 shadow-lg"
        >
          <span className="flex items-center gap-2"><Plus className="w-4 h-4" /> New</span>
        </Button>
      </div>

      <div className="px-4 sm:px-6 space-y-3">
        {resolved.length === 0 ? (
          <div className="text-center pt-16 pb-4 px-8">
            <div className="w-20 h-20 rounded-[1.75rem] glass-panel flex items-center justify-center mx-auto mb-5">
              <ListMusic className="w-8 h-8 text-white/30" />
            </div>
            <h2 className="text-xl font-display font-bold text-white mb-2">No playlists yet</h2>
            <p className="text-sm text-white/50 max-w-[300px] mx-auto leading-relaxed mb-8">
              Build your own mixes from songs in your collection — tap <span className="text-white font-bold">New</span> to create one.
            </p>
          </div>
        ) : (
          resolved.map(({ list, songs: inList }, index) => {
            const art = inList.find(s => s.artworkUrl)?.artworkUrl;
            return (
              <motion.button
                key={list.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index, 8) * 0.05, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                onClick={() => setLocation(`/playlists/${list.id}`)}
                className="w-full text-left glass-panel rounded-[1.75rem] p-4 flex items-center gap-4 hover:bg-white/10 hover:border-white/20 transition-all active:scale-[0.98] cursor-pointer"
              >
                <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 shadow-lg border border-white/10 bg-white/5">
                  {art
                    ? <img src={art} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><Music2 className="w-6 h-6 text-white/30" /></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold text-lg text-white truncate leading-tight">{list.name}</p>
                  <p className="text-xs text-white/50 mt-1">{inList.length} song{inList.length !== 1 ? 's' : ''}</p>
                </div>
                <div
                  role="button"
                  aria-label={`Play ${list.name}`}
                  onClick={e => handlePlay(e, inList)}
                  className="shrink-0 w-11 h-11 rounded-full bg-white text-black hover:bg-white/90 hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center justify-center"
                >
                  <Play className="w-4.5 h-4.5 fill-current ml-0.5" style={{ width: 18, height: 18 }} />
                </div>
                <ChevronRight className="w-5 h-5 text-white/30 shrink-0" />
              </motion.button>
            );
          })
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm rounded-[2rem] bg-card border border-white/10 p-6">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-xl font-display font-bold text-white">New playlist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <input
              autoFocus
              className="w-full h-12 rounded-2xl bg-white/5 border border-white/10 px-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Playlist name"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
              maxLength={60}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" className="rounded-full text-white/50" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button className="rounded-full font-bold px-6" disabled={!nameInput.trim()} onClick={handleCreate}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
