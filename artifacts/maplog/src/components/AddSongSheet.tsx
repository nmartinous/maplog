import React, { useState, useCallback, useRef } from 'react';
import { useMusicKit } from '@/context/MusicKitContext';
import type { MaplogSong, MaplogRarityType } from '@/lib/types';
import { DEMO_RARITIES } from '@/lib/rarityMap';
import { RarityBadge } from './RarityBadge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Music2, Loader2, ChevronLeft, Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Stage = 'search' | 'rarity';

export function AddSongSheet({ open, onOpenChange }: Props) {
  const { searchDeezer, addToCollection, songs: collection } = useMusicKit();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MaplogSong[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [stage, setStage] = useState<Stage>('search');
  const [selected, setSelected] = useState<MaplogSong | null>(null);
  const [chosenRarity, setChosenRarity] = useState<MaplogRarityType | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    setSearchError('');

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const found = await searchDeezer(q);
        setResults(found);
      } catch (err: any) {
        setSearchError(err?.message ?? 'Search failed');
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 420);
  }, [searchDeezer]);

  const handleSelectSong = (song: MaplogSong) => {
    setSelected(song);
    setChosenRarity(null);
    setStage('rarity');
  };

  const handleAdd = () => {
    if (!selected || !chosenRarity) return;
    addToCollection(selected, chosenRarity);
    handleClose();
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setQuery('');
      setResults([]);
      setStage('search');
      setSelected(null);
      setChosenRarity(null);
      setSearchError('');
    }, 300);
  };

  const alreadyInCollection = (songId: string) => collection.some(s => s.id === songId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md w-full p-0 gap-0 overflow-hidden max-h-[90dvh] flex flex-col bg-card border border-white/10 rounded-[2rem] shadow-2xl">
        <AnimatePresence mode="wait">
          {stage === 'search' ? (
            <motion.div 
              key="search"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col h-full overflow-hidden"
            >
              <DialogHeader className="px-6 pt-8 pb-4 shrink-0 border-b border-white/5">
                <DialogTitle className="text-2xl font-display font-black text-white">Add a Song</DialogTitle>
                <p className="text-sm text-white/50 mt-1">Search the global Deezer catalog</p>
              </DialogHeader>

              <div className="px-6 py-4 shrink-0 relative">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40 pointer-events-none" />
                  <Input
                    autoFocus
                    placeholder="Song or artist name..."
                    className="pl-12 h-14 bg-white/5 border-white/10 text-white placeholder:text-white/30 text-base rounded-2xl focus-visible:ring-primary/50 shadow-inner"
                    value={query}
                    onChange={handleQueryChange}
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-primary" />
                  )}
                </div>
                {searchError && (
                  <p className="text-destructive text-sm font-semibold mt-3 ml-1">{searchError}</p>
                )}
              </div>

              <div className="flex-1 overflow-y-auto min-h-0 pb-6">
                {!query.trim() ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                    <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
                      <Music2 className="w-8 h-8 text-white/20" />
                    </div>
                    <p className="text-base text-white/40 font-medium max-w-[200px] leading-relaxed">
                      Start typing to search for new additions to your binder
                    </p>
                  </div>
                ) : results.length === 0 && !isSearching ? (
                  <div className="text-center py-20 px-6">
                    <p className="text-lg font-bold text-white mb-2">No matches found</p>
                    <p className="text-white/40">Try a different search term.</p>
                  </div>
                ) : (
                  <div className="px-4">
                    {results.map((song, i) => {
                      const inCollection = alreadyInCollection(song.id);
                      return (
                        <motion.button
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          key={song.id}
                          onClick={() => handleSelectSong(song)}
                          className={cn(
                            'w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-left transition-all active:scale-[0.98] group',
                            'hover:bg-white/5',
                          )}
                        >
                          {song.artworkUrl ? (
                            <img
                              src={song.artworkUrl}
                              alt={song.title}
                              className="w-14 h-14 rounded-xl object-cover shrink-0 shadow-md group-hover:shadow-lg transition-shadow"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/10">
                              <Music2 className="w-6 h-6 text-white/20" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-base text-white truncate leading-tight mb-1">{song.title}</p>
                            <p className="text-sm text-white/50 truncate leading-tight">{song.artist}</p>
                          </div>
                          {inCollection && (
                            <div className="shrink-0 bg-primary/20 text-primary px-3 py-1 rounded-full text-xs font-bold border border-primary/30 shadow-[0_0_10px_rgba(255,60,0,0.2)]">
                              Owned
                            </div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          ) : selected ? (
            <motion.div 
              key="rarity"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex flex-col h-full overflow-hidden"
            >
              <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setStage('search')}
                    className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/70 hover:bg-white/10 hover:text-white transition-all"
                    aria-label="Back"
                  >
                    <ChevronLeft className="w-6 h-6 -ml-0.5" />
                  </button>
                  <div>
                    <DialogTitle className="text-xl font-display font-bold text-white">Select Tier</DialogTitle>
                    <p className="text-sm text-white/50">Assign a rarity card</p>
                  </div>
                </div>
              </DialogHeader>

              <div className="px-6 py-4 flex items-center gap-4 shrink-0 bg-white/5 mx-6 rounded-2xl border border-white/10 mb-4">
                {selected.artworkUrl ? (
                  <img src={selected.artworkUrl} alt={selected.title} className="w-16 h-16 rounded-xl object-cover shrink-0 shadow-md" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                    <Music2 className="w-8 h-8 text-white/30" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-bold text-lg text-white truncate leading-tight mb-1">{selected.title}</p>
                  <p className="text-sm text-white/60 truncate leading-tight">{selected.artist}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 pb-4 min-h-0">
                <div className="grid grid-cols-1 gap-3">
                  {DEMO_RARITIES.map(rarity => (
                    <button
                      key={rarity.slug}
                      onClick={() => setChosenRarity(rarity)}
                      className={cn(
                        'flex items-center gap-4 px-5 py-4 rounded-2xl border text-left transition-all group hover:scale-[1.02] active:scale-[0.98]',
                        chosenRarity?.slug === rarity.slug
                          ? 'border-primary bg-primary/10 shadow-[0_0_20px_rgba(255,60,0,0.2)]'
                          : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20',
                      )}
                    >
                      <RarityBadge slug={rarity.slug} name={rarity.name} category={rarity.category} size="md" />
                      <span className={cn(
                        "text-base font-bold truncate flex-1",
                        chosenRarity?.slug === rarity.slug ? "text-primary" : "text-white"
                      )}>
                        {rarity.name}
                      </span>
                      <div className={cn(
                        "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                        chosenRarity?.slug === rarity.slug ? "border-primary bg-primary" : "border-white/20 group-hover:border-white/40"
                      )}>
                        {chosenRarity?.slug === rarity.slug && <Check className="w-4 h-4 text-white" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="px-6 py-6 shrink-0 bg-background/50 backdrop-blur-xl border-t border-white/5">
                <Button
                  className="w-full rounded-2xl font-bold h-14 text-lg shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all"
                  onClick={handleAdd}
                  disabled={!chosenRarity}
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Add to Binder
                </Button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
