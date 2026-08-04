import React, { useState, useEffect } from 'react';
import { useLocation, useSearch } from 'wouter';
import {
  useCreateSong,
  useUpdateSong,
  useGetSong,
  useListRarityTypes,
  useCreateCollectedCard,
  useDeleteCollectedCard,
  getListSongsQueryKey,
  getGetSongQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Plus, Trash2, Loader2, Music, Layers, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────────────────

interface CardDraft {
  id?: number;      // existing card id (edit mode)
  rarityTypeId: number;
  rarityName: string;
  rarityCategory: string;
  rarityTier: number;
  variantLabel: string;
  artworkUrl: string;
  notes: string;
  saved: boolean;   // whether it's already persisted
}

// ─── Small sub-components ──────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-sm font-semibold text-foreground">{children}</label>;
}

function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2">{children}</div>;
}

function RarityBadge({ category, name, tier }: { category: string; name: string; tier: number }) {
  const colors: Record<string, string> = {
    Radiant:          'border-white/40 text-white bg-white/10',
    'Special Epic':   'border-rose-500/50 text-rose-300 bg-rose-500/10',
    'Streak Epic':    'border-orange-400/50 text-orange-300 bg-orange-500/10',
    Epic:             'border-yellow-400/50 text-yellow-300 bg-yellow-500/10',
    'Special Edition':'border-pink-400/50 text-pink-300 bg-pink-500/10',
    Shiny:            'border-violet-400/50 text-violet-300 bg-violet-500/10',
    Lyric:            'border-sky-400/50 text-sky-300 bg-sky-500/10',
    Moment:           'border-purple-400/50 text-purple-300 bg-purple-500/10',
    Regular:          'border-border text-muted-foreground bg-muted/30',
  };
  return (
    <span className={cn('text-xs font-bold border rounded-full px-2 py-0.5 tracking-wide', colors[category] || colors.Regular)}>
      {name}
    </span>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export default function AddSong() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const queryClient = useQueryClient();

  const editId = new URLSearchParams(search).get('edit');
  const isEdit = !!editId;

  // Song form state
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [genre, setGenre] = useState('');
  const [audioUrl, setAudioUrl] = useState('');

  // Card drafts (for adding new cards inline)
  const [cardDrafts, setCardDrafts] = useState<CardDraft[]>([]);
  const [showAddCard, setShowAddCard] = useState(false);
  const [selectedRarityTypeId, setSelectedRarityTypeId] = useState<number | null>(null);
  const [newVariantLabel, setNewVariantLabel] = useState('');
  const [newArtworkUrl, setNewArtworkUrl] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [isSavingSong, setIsSavingSong] = useState(false);
  const [savedSongId, setSavedSongId] = useState<number | null>(null);

  // Hooks
  const { data: existingSong, isLoading: loadingExisting } = useGetSong(
    Number(editId),
    { query: { enabled: isEdit && !!editId, queryKey: getGetSongQueryKey(Number(editId)) } }
  );
  const { data: rarityTypes } = useListRarityTypes();
  const createSong = useCreateSong();
  const updateSong = useUpdateSong();
  const createCard = useCreateCollectedCard();
  const deleteCard = useDeleteCollectedCard();

  // Pre-fill form when editing
  useEffect(() => {
    if (existingSong) {
      setTitle(existingSong.title || '');
      setArtist(existingSong.artist || '');
      setAlbum(existingSong.album || '');
      setGenre(existingSong.genre || '');
      setAudioUrl(existingSong.audioUrl || '');
      setSavedSongId(existingSong.id);
      // Populate existing cards
      if (existingSong.cards?.length) {
        setCardDrafts(existingSong.cards.map(card => ({
          id: card.id,
          rarityTypeId: card.rarityType.id,
          rarityName: card.rarityType.name,
          rarityCategory: card.rarityType.category,
          rarityTier: card.rarityType.tier,
          variantLabel: card.variantLabel || '',
          artworkUrl: card.artworkUrl || '',
          notes: card.notes || '',
          saved: true,
        })));
      }
    }
  }, [existingSong]);

  // ─── Handlers ──────────────────────────────────────────────────────────

  const handleSaveSong = async () => {
    if (!title.trim() || !artist.trim()) {
      toast.error('Title and artist are required.');
      return;
    }
    setIsSavingSong(true);
    try {
      if (isEdit && editId) {
        await updateSong.mutateAsync({
          id: Number(editId),
          data: { title: title.trim(), artist: artist.trim(), album: album.trim() || undefined, genre: genre.trim() || undefined, audioUrl: audioUrl.trim() || undefined },
        });
        setSavedSongId(Number(editId));
        toast.success('Song updated!');
        queryClient.invalidateQueries({ queryKey: getGetSongQueryKey(Number(editId)) });
      } else {
        const newSong = await createSong.mutateAsync({
          data: { title: title.trim(), artist: artist.trim(), album: album.trim() || undefined, genre: genre.trim() || undefined, audioUrl: audioUrl.trim() || undefined },
        });
        setSavedSongId(newSong.id);
        toast.success('Song saved! Now add your cards below.');
        queryClient.invalidateQueries({ queryKey: getListSongsQueryKey() });
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save song.');
    } finally {
      setIsSavingSong(false);
    }
  };

  const handleAddCardDraft = () => {
    if (!selectedRarityTypeId) {
      toast.error('Pick a rarity type first.');
      return;
    }
    const rarity = rarityTypes?.find(r => r.id === selectedRarityTypeId);
    if (!rarity) return;

    setCardDrafts(prev => [
      ...prev,
      {
        rarityTypeId: rarity.id,
        rarityName: rarity.name,
        rarityCategory: rarity.category,
        rarityTier: rarity.tier,
        variantLabel: newVariantLabel.trim(),
        artworkUrl: newArtworkUrl.trim(),
        notes: newNotes.trim(),
        saved: false,
      },
    ]);
    setSelectedRarityTypeId(null);
    setNewVariantLabel('');
    setNewArtworkUrl('');
    setNewNotes('');
    setShowAddCard(false);
  };

  const handleSaveCards = async () => {
    if (!savedSongId) {
      toast.error('Save the song details first.');
      return;
    }
    const unsaved = cardDrafts.filter(c => !c.saved);
    if (!unsaved.length) {
      toast('No new cards to save.');
      return;
    }
    let saved = 0;
    for (const draft of unsaved) {
      try {
        await createCard.mutateAsync({
          data: {
            songId: savedSongId,
            rarityTypeId: draft.rarityTypeId,
            variantLabel: draft.variantLabel || undefined,
            artworkUrl: draft.artworkUrl || undefined,
            notes: draft.notes || undefined,
          },
        });
        saved++;
      } catch (e: any) {
        toast.error(`Failed to save ${draft.rarityName}: ${e?.message}`);
      }
    }
    if (saved > 0) {
      toast.success(`${saved} card${saved !== 1 ? 's' : ''} saved!`);
      queryClient.invalidateQueries({ queryKey: getGetSongQueryKey(savedSongId) });
      setCardDrafts(prev =>
        prev.map(c => (!c.saved ? { ...c, saved: true } : c))
      );
    }
  };

  const handleRemoveCard = async (index: number) => {
    const draft = cardDrafts[index];
    if (draft.saved && draft.id) {
      if (!confirm('Remove this card from your collection?')) return;
      try {
        await deleteCard.mutateAsync({ id: draft.id });
        toast.success('Card removed.');
        queryClient.invalidateQueries({ queryKey: getGetSongQueryKey(savedSongId!) });
        setCardDrafts(prev => prev.filter((_, i) => i !== index));
      } catch {
        toast.error('Failed to remove card.');
      }
    } else {
      setCardDrafts(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleDone = () => {
    if (savedSongId) {
      setLocation(`/song/${savedSongId}`);
    } else {
      setLocation('/collection');
    }
  };

  // ─── Sorted rarity types by tier ───────────────────────────────────────
  const sortedRarities = (rarityTypes || []).slice().sort((a, b) => a.tier - b.tier);

  // ─── Loading state for edit mode ────────────────────────────────────────
  if (isEdit && loadingExisting) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const songSaved = !!savedSongId;
  const unsavedCards = cardDrafts.filter(c => !c.saved).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 pb-24 sm:pb-8 animate-in fade-in max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full bg-card/50 shrink-0"
          onClick={() => window.history.back()}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            {isEdit ? 'Edit Song' : 'Add Song'}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isEdit ? 'Update song details and manage cards.' : 'Save a song, then log which cards you have collected.'}
          </p>
        </div>
      </div>

      {/* ── Song Details ──────────────────────────────────────────────── */}
      <section className="bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-5 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Music className="h-5 w-5 text-primary" />
          <h2 className="font-bold text-lg">Song Details</h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <FieldGroup>
            <FieldLabel>Title *</FieldLabel>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Golden Hour"
              className="h-11"
              disabled={songSaved && !isEdit}
            />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel>Artist *</FieldLabel>
            <Input
              value={artist}
              onChange={e => setArtist(e.target.value)}
              placeholder="JVKE"
              className="h-11"
              disabled={songSaved && !isEdit}
            />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel>Album</FieldLabel>
            <Input
              value={album}
              onChange={e => setAlbum(e.target.value)}
              placeholder="this is what ____ feels like"
              className="h-11"
              disabled={songSaved && !isEdit}
            />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel>Genre</FieldLabel>
            <Input
              value={genre}
              onChange={e => setGenre(e.target.value)}
              placeholder="e.g. Jazz, Pop, Hip-Hop"
              className="h-11"
              disabled={songSaved && !isEdit}
            />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel>Audio URL</FieldLabel>
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={audioUrl}
                onChange={e => setAudioUrl(e.target.value)}
                placeholder="https://your-server.com/audio.mp3"
                className="h-11 pl-9"
                type="url"
                disabled={songSaved && !isEdit}
              />
            </div>
          </FieldGroup>
        </div>

        <Button
          onClick={handleSaveSong}
          disabled={isSavingSong || !title.trim() || !artist.trim()}
          className="w-full sm:w-auto h-11 font-bold rounded-xl"
        >
          {isSavingSong && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {songSaved ? (isEdit ? 'Save Changes' : '✓ Song Saved') : 'Save Song'}
        </Button>
      </section>

      {/* ── Cards ─────────────────────────────────────────────────────── */}
      <section className={cn(
        "bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-5 transition-opacity duration-300",
        !songSaved && "opacity-40 pointer-events-none"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h2 className="font-bold text-lg">Collected Cards</h2>
            {cardDrafts.length > 0 && (
              <span className="text-xs bg-primary/20 text-primary font-bold px-2 py-0.5 rounded-full">
                {cardDrafts.length}
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 rounded-full"
            onClick={() => setShowAddCard(v => !v)}
          >
            <Plus className="h-4 w-4" />
            Add Card
          </Button>
        </div>

        {/* Add card form */}
        {showAddCard && (
          <div className="bg-background border border-border/60 rounded-xl p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
            <FieldGroup>
              <FieldLabel>Rarity Type *</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {sortedRarities.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedRarityTypeId(r.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                      selectedRarityTypeId === r.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    )}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            </FieldGroup>

            <div className="grid sm:grid-cols-2 gap-3">
              <FieldGroup>
                <FieldLabel>Variant Label</FieldLabel>
                <Input
                  value={newVariantLabel}
                  onChange={e => setNewVariantLabel(e.target.value)}
                  placeholder="e.g. Grammy, #031, Freshman"
                  className="h-10"
                />
              </FieldGroup>
              <FieldGroup>
                <FieldLabel>Artwork URL</FieldLabel>
                <Input
                  value={newArtworkUrl}
                  onChange={e => setNewArtworkUrl(e.target.value)}
                  placeholder="https://..."
                  className="h-10"
                  type="url"
                />
              </FieldGroup>
            </div>

            <FieldGroup>
              <FieldLabel>Notes</FieldLabel>
              <Input
                value={newNotes}
                onChange={e => setNewNotes(e.target.value)}
                placeholder="Optional notes about this card..."
                className="h-10"
              />
            </FieldGroup>

            <div className="flex gap-2">
              <Button
                onClick={handleAddCardDraft}
                disabled={!selectedRarityTypeId}
                size="sm"
                className="font-bold"
              >
                Add to List
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAddCard(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Cards list */}
        {cardDrafts.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-border/50 rounded-xl">
            <Layers className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No cards added yet.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Tap "Add Card" to log a rarity.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {cardDrafts.map((draft, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border transition-all",
                  draft.saved
                    ? "bg-card border-border"
                    : "bg-primary/5 border-primary/30"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <RarityBadge category={draft.rarityCategory} name={draft.rarityName} tier={draft.rarityTier} />
                    {draft.variantLabel && (
                      <span className="text-xs text-muted-foreground font-mono">({draft.variantLabel})</span>
                    )}
                    {!draft.saved && (
                      <span className="text-[10px] font-bold text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded-full">
                        unsaved
                      </span>
                    )}
                  </div>
                  {draft.notes && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">"{draft.notes}"</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => handleRemoveCard(i)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Save cards button */}
        {unsavedCards > 0 && (
          <Button
            onClick={handleSaveCards}
            disabled={createCard.isPending}
            className="w-full font-bold h-11 rounded-xl"
          >
            {createCard.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save {unsavedCards} Card{unsavedCards !== 1 ? 's' : ''}
          </Button>
        )}
      </section>

      {/* Done button */}
      {songSaved && (
        <div className="mt-6">
          <Button
            variant="outline"
            className="w-full h-11 rounded-xl font-bold"
            onClick={handleDone}
          >
            Done — View Song
          </Button>
        </div>
      )}
    </div>
  );
}
