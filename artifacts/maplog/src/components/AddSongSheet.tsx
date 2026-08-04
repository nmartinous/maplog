import React, { useState, useCallback, useRef } from 'react';
import { useMusicKit } from '@/context/MusicKitContext';
import type { MaplogSong, MaplogRarityType } from '@/lib/types';
import { ALL_RARITIES } from '@/lib/rarityMap';
import { RarityBadge } from './RarityBadge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Music2, Loader2, ChevronLeft, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Stage = 'search' | 'rarity';

export function AddSongSheet({ open, onOpenChange }: Props) {
  const { searchDeezer, addToCollection, songs: collection } = useMusicKit();

  const [query, setQuery]           = useState('');
  const [results, setResults]       = useState<MaplogSong[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [stage, setStage]           = useState<Stage>('search');
  const [selected, setSelected]     = useState<MaplogSong | null>(null);
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
    // reset after animation
    setTimeout(() => {
      setQuery('');
      setResults([]);
      setStage('search');
      setSelected(null);
      setChosenRarity(null);
      setSearchError('');
    }, 200);
  };

  const alreadyInCollection = (songId: string) =>
    collection.some(s => s.id === songId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md w-full p-0 gap-0 overflow-hidden max-h-[90dvh] flex flex-col">

        {/* ── Stage: Search ── */}
        {stage === 'search' && (
          <>
            <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
              <DialogTitle className="text-lg font-extrabold">Add a song</DialogTitle>
            </DialogHeader>

            {/* Search input */}
            <div className="px-5 pb-3 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  autoFocus
                  placeholder="Search by song or artist…"
                  className="pl-9 h-10 bg-muted/40 border-border/60 text-sm"
                  value={query}
                  onChange={handleQueryChange}
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {searchError && (
                <p className="text-destructive text-xs mt-2">{searchError}</p>
              )}
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto pb-4 min-h-0">
              {!query.trim() ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                  <Music2 className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground/60">Type a song or artist name above</p>
                </div>
              ) : results.length === 0 && !isSearching ? (
                <div className="text-center py-12 text-sm text-muted-foreground/60">
                  No results for "{query}"
                </div>
              ) : (
                <div>
                  {results.map(song => {
                    const inCollection = alreadyInCollection(song.id);
                    return (
                      <button
                        key={song.id}
                        onClick={() => handleSelectSong(song)}
                        className={cn(
                          'w-full flex items-center gap-3 px-5 py-3 text-left transition-colors',
                          'hover:bg-white/[0.04] active:bg-white/[0.06]',
                        )}
                      >
                        {song.artworkUrl ? (
                          <img
                            src={song.artworkUrl}
                            alt={song.title}
                            className="w-11 h-11 rounded-lg object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <Music2 className="w-5 h-5 text-muted-foreground/40" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[14px] truncate">{song.title}</p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{song.artist}</p>
                        </div>
                        {inCollection && (
                          <span className="shrink-0 text-[10px] font-bold text-primary/70 bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                            +card
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Stage: Rarity picker ── */}
        {stage === 'rarity' && selected && (
          <>
            <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStage('search')}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Back"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <DialogTitle className="text-lg font-extrabold">Choose rarity</DialogTitle>
              </div>
            </DialogHeader>

            {/* Song preview */}
            <div className="px-5 pb-3 flex items-center gap-3 shrink-0">
              {selected.artworkUrl ? (
                <img src={selected.artworkUrl} alt={selected.title} className="w-12 h-12 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <Music2 className="w-6 h-6 text-muted-foreground/40" />
                </div>
              )}
              <div className="min-w-0">
                <p className="font-bold text-[15px] truncate">{selected.title}</p>
                <p className="text-xs text-muted-foreground truncate">{selected.artist}</p>
              </div>
            </div>

            {/* Rarity grid */}
            <div className="flex-1 overflow-y-auto px-5 pb-3 min-h-0">
              <div className="grid grid-cols-2 gap-2">
                {ALL_RARITIES.map(rarity => (
                  <button
                    key={rarity.slug}
                    onClick={() => setChosenRarity(rarity)}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all',
                      chosenRarity?.slug === rarity.slug
                        ? 'border-primary bg-primary/10'
                        : 'border-border/60 bg-muted/20 hover:bg-muted/40 hover:border-border',
                    )}
                  >
                    <RarityBadge slug={rarity.slug} name={rarity.name} category={rarity.category} />
                    <span className="text-xs font-semibold text-foreground truncate">{rarity.name}</span>
                    {chosenRarity?.slug === rarity.slug && (
                      <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Confirm */}
            <div className="px-5 pb-5 pt-3 shrink-0 border-t border-border/40">
              <Button
                className="w-full rounded-xl font-bold"
                size="lg"
                onClick={handleAdd}
                disabled={!chosenRarity}
              >
                Add to collection
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
