import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { useMusicKit } from '@/context/MusicKitContext';
import type { MaplogSong, MaplogCard } from '@/lib/types';
import { normalizeTags, labelForTags, validateTrackCards, loadTagRules } from '@/lib/tags';
import {
  loadOverrideMeta, upsertOverride, deleteOverride, builtInOverrideTags,
  canonicalTag, type OverrideMeta,
} from '@/lib/overrides';
import {
  BADGE_TIERS, BADGE_LABELS, BADGE_COLORS, loadArtistBadges, toggleArtistBadge, artistKey,
} from '@/lib/badges';
import { putCardMedia, getCardMedia, deleteCardMedia, listMediaCardIds } from '@/lib/mediaStore';
import { presenceForCard, RADIANT_PATTERNS, DEFAULT_RADIANT_PATTERN } from '@/lib/cardTemplates';
import { invalidateCardMedia } from '@/lib/useCardMedia';
import { ConflictQueue } from '@/components/ConflictQueue';
import { TagPlaylistLinkEditor } from '@/components/TagPlaylistLinkEditor';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ChevronDown, Pencil, Layers, Award, AlertTriangle, Search,
  Film, Trash2, Plus, X, Check, Tags, Hash,
} from 'lucide-react';

// ── Section shell ─────────────────────────────────────────────────────────────

function Section({ icon: Icon, title, description, count, children, defaultOpen = false }: {
  icon: React.ElementType; title: string; description: string;
  count?: number; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass-panel rounded-[2rem] overflow-hidden">
      <button
        className="w-full flex items-center gap-5 px-6 py-5 text-left hover:bg-white/5 active:bg-white/10 transition-colors group"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        data-testid={`edit-section-${title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
          <Icon className="h-6 w-6 text-white/70 group-hover:text-primary transition-colors" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base text-white mb-0.5 flex items-center gap-2">
            {title}
            {count != null && count > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-black">{count}</span>
            )}
          </p>
          <p className="text-sm text-white/50">{description}</p>
        </div>
        <ChevronDown className={cn('h-5 w-5 text-white/50 transition-transform duration-300', open ? 'rotate-180' : '')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            className="border-t border-white/5 overflow-hidden"
          >
            <div className="px-5 py-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const inputCls = 'w-full h-11 rounded-xl bg-white/5 border border-white/10 px-3.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-primary/50';
const labelCls = 'text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5 block';

// ── Card media upload ─────────────────────────────────────────────────────────

const MAX_MEDIA_BYTES = 60 * 1024 * 1024; // keep IndexedDB usage sane

function CardMediaControl({ cardId, disabled, hasMedia, onChanged }: {
  cardId: string; disabled: boolean; hasMedia: boolean; onChanged: () => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_MEDIA_BYTES) { toast.error('That file is too large (60 MB max).'); return; }
    setBusy(true);
    try {
      await putCardMedia(cardId, file);
      invalidateCardMedia(cardId);
      toast.success(file.type.startsWith('video/') ? 'Video attached to this card.' : 'Image attached to this card.');
      onChanged();
    } catch {
      toast.error('Could not store the file — your device may be out of space.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try { await deleteCardMedia(cardId); invalidateCardMedia(cardId); onChanged(); toast.info('Media removed.'); }
    catch { toast.error('Could not remove the media.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex items-center gap-2">
      <input ref={inputRef} type="file" accept="video/*,image/*" className="hidden" onChange={onFile} />
      <Button variant="outline" size="sm" disabled={disabled || busy}
        className="rounded-full bg-white/5 border-white/10 hover:bg-white/10 text-white text-xs font-bold h-8"
        onClick={() => inputRef.current?.click()}
        data-testid={`media-upload-${cardId}`}>
        <Film className="w-3.5 h-3.5 mr-1.5" />
        {hasMedia ? 'Replace media' : 'Add media'}
      </Button>
      {hasMedia && (
        <Button variant="ghost" size="sm" disabled={disabled || busy}
          className="rounded-full text-white/40 hover:text-destructive hover:bg-destructive/10 text-xs font-bold h-8"
          onClick={remove}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}

/** Inline preview of attached media (small, lazy). */
function CardMediaPreview({ cardId, version }: { cardId: string; version: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [kind, setKind] = useState<'image' | 'video' | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    getCardMedia(cardId).then(m => {
      if (cancelled || !m) return;
      objectUrl = URL.createObjectURL(m.blob);
      setUrl(objectUrl);
      setKind(m.type);
    }).catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl(null); setKind(null);
    };
  }, [cardId, version]);

  if (!url) return null;
  return kind === 'video'
    ? <video src={url} className="w-16 h-16 rounded-xl object-cover border border-white/10" muted playsInline loop autoPlay />
    : <img src={url} alt="" className="w-16 h-16 rounded-xl object-cover border border-white/10" />;
}

// ── Song editor ───────────────────────────────────────────────────────────────

function SongEditor({ mediaIds, refreshMedia, mediaVersion }: {
  mediaIds: Set<string>; refreshMedia: () => void; mediaVersion: number;
}) {
  const { songs, updateSong, updateCardTags, updateCardMeta, removeSong } = useMusicKit();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return songs
      .filter(s => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q))
      .slice(0, 8);
  }, [songs, query]);

  const song = songs.find(s => s.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="w-4 h-4 text-white/30 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          className={cn(inputCls, 'pl-10')}
          placeholder="Search your collection…"
          value={query}
          onChange={e => { setQuery(e.target.value); setSelectedId(null); }}
          data-testid="song-editor-search"
        />
      </div>

      {!song && matches.length > 0 && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/5 divide-y divide-white/5 overflow-hidden">
          {matches.map(s => (
            <button key={s.id} className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-white/5"
              onClick={() => setSelectedId(s.id)} data-testid={`song-pick-${s.id}`}>
              {s.artworkUrl
                ? <img src={s.artworkUrl} alt="" className="w-9 h-9 rounded-lg object-cover" />
                : <div className="w-9 h-9 rounded-lg bg-white/5" />}
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{s.title}</p>
                <p className="text-[11px] text-white/40 truncate">{s.artist} · {s.cards.length} card{s.cards.length === 1 ? '' : 's'}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {!song && matches.length === 0 && query.trim() && (
        <p className="text-sm text-white/40 px-1">No songs match "{query.trim()}".</p>
      )}

      {song && (
        <SelectedSongEditor
          key={song.id}
          song={song}
          disabled={false}
          updateSong={updateSong}
          updateCardTags={updateCardTags}
          updateCardMeta={updateCardMeta}
          removeSong={removeSong}
          onClose={() => setSelectedId(null)}
          mediaIds={mediaIds}
          refreshMedia={refreshMedia}
          mediaVersion={mediaVersion}
        />
      )}
    </div>
  );
}

function SelectedSongEditor({ song, disabled, updateSong, updateCardTags, updateCardMeta, removeSong, onClose, mediaIds, refreshMedia, mediaVersion }: {
  song: MaplogSong;
  disabled: boolean;
  updateSong: (id: string, patch: Partial<Pick<MaplogSong, 'title' | 'artist' | 'album' | 'genre'>>) => void;
  updateCardTags: (songId: string, cardId: string, tags: string[]) => void;
  updateCardMeta: (songId: string, cardId: string, patch: Partial<Pick<MaplogCard, 'flavorText' | 'subjectText' | 'pin' | 'patternId' | 'variantLabel'>>) => void;
  removeSong: (songId: string) => void;
  onClose: () => void;
  mediaIds: Set<string>; refreshMedia: () => void; mediaVersion: number;
}) {
  const [title, setTitle] = useState(song.title);
  const [artist, setArtist] = useState(song.artist);
  const [album, setAlbum] = useState(song.album);
  const [genre, setGenre] = useState(song.genre ?? '');
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const infoDirty = title !== song.title || artist !== song.artist || album !== song.album || (genre || null) !== (song.genre ?? null);

  const saveInfo = () => {
    if (!title.trim() || !artist.trim()) { toast.error('Title and artist are required.'); return; }
    updateSong(song.id, { title: title.trim(), artist: artist.trim(), album: album.trim(), genre: genre.trim() || null });
    toast.success('Song info saved.');
  };

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-4 space-y-5">
      <div className="flex items-center gap-3">
        {song.artworkUrl
          ? <img src={song.artworkUrl} alt="" className="w-12 h-12 rounded-xl object-cover" />
          : <div className="w-12 h-12 rounded-xl bg-white/5" />}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white truncate">{song.title}</p>
          <p className="text-xs text-white/40 truncate">{song.artist}</p>
        </div>
        <button onClick={onClose} aria-label="Close editor"
          className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10">
          <X className="w-4 h-4 text-white/60" />
        </button>
      </div>

      {/* Remove from collection */}
      {confirmingRemove ? (
        <div className="rounded-xl bg-destructive/10 border border-destructive/30 px-3.5 py-3 space-y-2.5">
          <p className="text-sm font-bold text-red-300">Remove "{song.title}" from your collection?</p>
          <p className="text-xs text-white/50">This deletes all {song.cards.length} card{song.cards.length === 1 ? '' : 's'} and any uploaded media. This can't be undone.</p>
          <div className="flex gap-2">
            <Button size="sm" variant="destructive"
              className="rounded-full font-bold h-8 px-4 text-xs"
              onClick={() => { removeSong(song.id); toast.success(`"${song.title}" removed from collection.`); onClose(); }}
              data-testid="confirm-remove-song">
              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Remove
            </Button>
            <Button size="sm" variant="ghost"
              className="rounded-full text-white/40 h-8 text-xs"
              onClick={() => setConfirmingRemove(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="ghost"
          className="rounded-full text-white/30 hover:text-destructive hover:bg-destructive/10 h-8 px-3 text-xs"
          onClick={() => setConfirmingRemove(true)}
          data-testid="remove-song-btn">
          <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Remove from collection
        </Button>
      )}

      {/* Info */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelCls}>Title</label>
          <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} disabled={disabled} data-testid="edit-song-title" />
        </div>
        <div>
          <label className={labelCls}>Artist</label>
          <input className={inputCls} value={artist} onChange={e => setArtist(e.target.value)} disabled={disabled} />
        </div>
        <div>
          <label className={labelCls}>Album</label>
          <input className={inputCls} value={album} onChange={e => setAlbum(e.target.value)} disabled={disabled} />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Genre</label>
          <input className={inputCls} value={genre} onChange={e => setGenre(e.target.value)} disabled={disabled} />
        </div>
      </div>
      {infoDirty && (
        <Button size="sm" className="rounded-full font-bold h-9 px-5" onClick={saveInfo} disabled={disabled} data-testid="save-song-info">
          <Check className="w-4 h-4 mr-1.5" /> Save info
        </Button>
      )}

      {/* Cards */}
      <div className="space-y-3">
        <p className={labelCls}>Cards ({song.cards.length})</p>
        {song.cards.map(card => (
          <CardTagEditor key={card.id} song={song} card={card} disabled={disabled}
            updateCardTags={updateCardTags} updateCardMeta={updateCardMeta}
            hasMedia={mediaIds.has(card.id)} refreshMedia={refreshMedia} mediaVersion={mediaVersion} />
        ))}
      </div>
    </div>
  );
}

function CardTagEditor({ song, card, disabled, updateCardTags, updateCardMeta, hasMedia, refreshMedia, mediaVersion }: {
  song: MaplogSong; card: MaplogCard; disabled: boolean;
  updateCardTags: (songId: string, cardId: string, tags: string[]) => void;
  updateCardMeta: (songId: string, cardId: string, patch: Partial<Pick<MaplogCard, 'flavorText' | 'subjectText' | 'pin' | 'patternId' | 'variantLabel'>>) => void;
  hasMedia: boolean; refreshMedia: () => void; mediaVersion: number;
}) {
  const currentTags = card.tags ?? [];
  const [draft, setDraft] = useState(currentTags.join(' '));
  const draftTags = useMemo(() => normalizeTags(draft.split(/[\s,#]+/)), [draft]);
  const dirty = draftTags.join(' ') !== normalizeTags(currentTags).join(' ');

  // Validate the whole track with this card's pool replaced
  const validation = useMemo(() => {
    if (!dirty) return null;
    const proposed = song.cards.map(c => c.id === card.id ? { ...c, tags: draftTags } : c);
    return validateTrackCards(proposed, loadTagRules());
  }, [dirty, draftTags, song.cards, card.id]);

  const problems: string[] = [];
  if (validation) {
    if (draftTags.length === 0) problems.push('At least one tag is required.');
    if (validation.deduped > 0) problems.push('Another card of this song already has exactly these tags.');
    problems.push(...validation.conflictGroups.map(g => g.reason));
  }
  const canSave = dirty && problems.length === 0;

  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3.5 space-y-3">
      <div className="flex items-center gap-3">
        <CardMediaPreview cardId={card.id} version={mediaVersion} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">{labelForTags(card.tags) === 'Unknown' ? card.rarityType.name : labelForTags(card.tags)}</p>
          <p className="text-[10px] text-white/30 truncate font-mono">{card.id}</p>
        </div>
        <CardMediaControl cardId={card.id} disabled={disabled} hasMedia={hasMedia} onChanged={refreshMedia} />
      </div>
      <div>
        <label className={labelCls}>Tags (space-separated)</label>
        <input className={cn(inputCls, 'font-mono text-xs')} value={draft}
          onChange={e => setDraft(e.target.value)} disabled={disabled}
          data-testid={`card-tags-${card.id}`} />
      </div>
      {dirty && problems.length > 0 && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 space-y-1">
          {problems.map((p, i) => (
            <p key={i} className="text-[11px] text-amber-200/80 flex items-start gap-1.5">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />{p}
            </p>
          ))}
        </div>
      )}
      {dirty && (
        <div className="flex gap-2">
          <Button size="sm" className="rounded-full font-bold h-8 px-4 text-xs" disabled={disabled || !canSave}
            onClick={() => { updateCardTags(song.id, card.id, draftTags); toast.success(`Card is now ${labelForTags(draftTags)}.`); }}
            data-testid={`save-card-tags-${card.id}`}>
            Save as {labelForTags(draftTags)}
          </Button>
          <Button variant="ghost" size="sm" className="rounded-full text-white/40 text-xs h-8"
            onClick={() => setDraft(currentTags.join(' '))}>
            Reset
          </Button>
        </div>
      )}
      <CardDisplayEditor song={song} card={card} disabled={disabled} updateCardMeta={updateCardMeta} />
    </div>
  );
}

/** Presence-specific display fields (flavor text, lyric subject, pin, epic number, radiant pattern). */
function CardDisplayEditor({ song, card, disabled, updateCardMeta }: {
  song: MaplogSong; card: MaplogCard; disabled: boolean;
  updateCardMeta: (songId: string, cardId: string, patch: Partial<Pick<MaplogCard, 'flavorText' | 'subjectText' | 'pin' | 'patternId' | 'variantLabel'>>) => void;
}) {
  const presence = presenceForCard(card);
  const [flavor, setFlavor] = useState(card.flavorText ?? '');
  const [subject, setSubject] = useState(card.subjectText ?? '');
  const [pin, setPin] = useState(card.pin ?? '');
  const [variantLabel, setVariantLabel] = useState(card.variantLabel ?? '');

  if (presence === 'regular') return null;

  const showFlavor = presence === 'moment' || presence === 'lyrics';
  const showSubject = presence === 'lyrics';
  const showPin = presence === 'epic';
  const showPattern = presence === 'radiant';

  // Epic number constraints based on rarity slug
  const NUMBERED_SLUGS = ['epic-common', 'epic-uncommon', 'epic-rare'];
  const isNumbered   = NUMBERED_SLUGS.includes(card.rarityType.slug);
  const isUnnumbered = card.rarityType.slug === 'epic-unnumbered';
  // Numbered = must keep a number; Unnumbered = number field hidden entirely
  const showVariantLabel = showPin && !isUnnumbered;
  const variantLabelEmpty = showVariantLabel && isNumbered && !variantLabel.trim();

  const dirty =
    (showFlavor && flavor.trim() !== (card.flavorText ?? '')) ||
    (showSubject && subject.trim() !== (card.subjectText ?? '')) ||
    (showPin && pin.trim() !== (card.pin ?? '')) ||
    (showVariantLabel && (variantLabel.trim() || null) !== (card.variantLabel ?? null));

  const save = () => {
    if (variantLabelEmpty) {
      toast.error('Numbered epics must keep their number — enter a number or leave as-is.');
      return;
    }
    const patch: Partial<Pick<MaplogCard, 'flavorText' | 'subjectText' | 'pin' | 'variantLabel'>> = {};
    if (showFlavor) patch.flavorText = flavor.trim() || null;
    if (showSubject) patch.subjectText = subject.trim() || null;
    if (showPin) {
      patch.pin = pin.trim() || null;
      if (showVariantLabel) {
        // Auto-prepend # if user typed a bare number
        const vl = variantLabel.trim();
        patch.variantLabel = vl ? (vl.startsWith('#') ? vl : `#${vl}`) : null;
      }
    }
    updateCardMeta(song.id, card.id, patch);
    toast.success('Card display saved.');
  };

  // Visual description for each presence type
  const PRESENCE_GUIDE: Record<string, { color: string; title: string; summary: string }> = {
    shiny:   { color: 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200', title: '✨ Shiny', summary: 'Rainbow iridescent foil sweeps over the full card. No extra config needed — the foil fires automatically.' },
    epic:    { color: 'border-amber-500/30 bg-amber-500/10 text-amber-200', title: '🏆 Epic', summary: 'Golden gradient frame + video/image clip slot. Upload a clip via "Add media" above. Optional: set an emoji pin (bottom-left) and pick a frame style via its visual tag.' },
    lyrics:  { color: 'border-orange-400/30 bg-orange-400/10 text-orange-200', title: '🎵 Lyrics', summary: 'Dark card with the lyric line overlaid on the art. Fill in "Lyric line" (the quote shown over the photo) and "Flavor text" (small bubble at the bottom, the puller\'s note).' },
    moment:  { color: 'border-red-400/30 bg-red-400/10 text-red-200', title: '⭐ Moment', summary: 'Twinkling star-field background + video/image clip slot. Upload the captured moment clip via "Add media". Optional: add flavor text as an uploader note.' },
    radiant: { color: 'border-violet-500/30 bg-violet-500/10 text-violet-200', title: '🌀 Radiant', summary: 'Shimmering pattern overlay tinted by the art color. Drag left/right to flip the card and see the back. Pick a pattern below (Prism, Waves, Orbits, Sparks).' },
  };
  const tags = card.tags ?? [];
  const presenceTag = tags.find(t => ['shiny','epic','lyrics','moment','radiant'].includes(t)) ?? presence;
  const guide = PRESENCE_GUIDE[presenceTag];

  return (
    <div className="space-y-2.5 pt-1 border-t border-white/5">
      {guide && (
        <div className={`rounded-xl border px-3 py-2.5 text-xs leading-relaxed ${guide.color}`}>
          <span className="font-black">{guide.title} — </span>{guide.summary}
        </div>
      )}
      <p className={labelCls}>Card display</p>
      {showSubject && (
        <div>
          <label className={labelCls}>Lyric line</label>
          <input className={inputCls} value={subject} onChange={e => setSubject(e.target.value)}
            disabled={disabled} placeholder="The lyric shown on the card"
            data-testid={`card-subject-${card.id}`} />
        </div>
      )}
      {showFlavor && (
        <div>
          <label className={labelCls}>{presence === 'lyrics' ? 'Puller flavor text' : 'Uploader flavor text'}</label>
          <input className={inputCls} value={flavor} onChange={e => setFlavor(e.target.value)}
            disabled={disabled} placeholder="Shown as a quote bubble"
            data-testid={`card-flavor-${card.id}`} />
        </div>
      )}
      {showPin && (
        <>
          {showVariantLabel ? (
            <div>
              <label className={labelCls}>
                Epic number{isNumbered && <span className="text-red-400 ml-1">*</span>}
              </label>
              <div className="relative">
                <Hash className="w-3.5 h-3.5 text-white/30 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  className={cn(inputCls, 'pl-9', variantLabelEmpty && 'ring-2 ring-red-500/50 border-red-500/50')}
                  value={variantLabel}
                  onChange={e => setVariantLabel(e.target.value)}
                  disabled={disabled}
                  placeholder={isNumbered ? 'Required — e.g. 1 or 42' : 'e.g. 1 or 42  (optional)'}
                  data-testid={`card-variant-label-${card.id}`}
                />
              </div>
              {variantLabelEmpty && (
                <p className="text-[10px] text-red-400 mt-1">Numbered epics must keep their number.</p>
              )}
              {!variantLabelEmpty && (
                <p className="text-[10px] text-white/30 mt-1">Shown as a pill in the top-right corner of the card.</p>
              )}
            </div>
          ) : isUnnumbered ? (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/5">
              <Hash className="w-3.5 h-3.5 text-white/20 shrink-0" />
              <p className="text-xs text-white/30">Unnumbered — no edition number for this card.</p>
            </div>
          ) : null}
          <div>
            <label className={labelCls}>Pin (emoji)</label>
            <input className={inputCls} value={pin} onChange={e => setPin(e.target.value)}
              disabled={disabled} placeholder="e.g. 🌈 or 🥤" maxLength={8}
              data-testid={`card-pin-${card.id}`} />
          </div>
        </>
      )}
      {showPattern && (
        <div>
          <label className={labelCls}>Pattern</label>
          <div className="flex flex-wrap gap-1.5">
            {Object.values(RADIANT_PATTERNS).map(p => {
              const active = (card.patternId ?? DEFAULT_RADIANT_PATTERN) === p.id;
              return (
                <button key={p.id} disabled={disabled}
                  className={cn('px-3 py-1.5 rounded-full text-xs font-bold border transition-colors',
                    active ? 'bg-violet-500/25 border-violet-400/50 text-violet-200' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10')}
                  onClick={() => { updateCardMeta(song.id, card.id, { patternId: p.id }); toast.success(`Pattern: ${p.label}`); }}
                  data-testid={`card-pattern-${p.id}-${card.id}`}>
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {dirty && (
        <Button size="sm" className="rounded-full font-bold h-8 px-4 text-xs" disabled={disabled}
          onClick={save} data-testid={`save-card-display-${card.id}`}>
          Save display
        </Button>
      )}
    </div>
  );
}

// ── Override rarity manager ───────────────────────────────────────────────────

const OVERRIDE_PRESENCES = ['regular', 'shiny', 'epic'];

function OverrideManager({ disabled }: { disabled: boolean }) {
  const [metas, setMetas] = useState<OverrideMeta[]>(() => loadOverrideMeta());
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState('');
  const [appliesTo, setAppliesTo] = useState<string[]>(['regular']);
  const [multiplier, setMultiplier] = useState('');
  const [pin, setPin] = useState('');
  const [flavorText, setFlavorText] = useState('');
  const [subjectText, setSubjectText] = useState('');
  const [frame, setFrame] = useState('');
  const [background, setBackground] = useState('');

  const resetForm = () => {
    setLabel(''); setAppliesTo(['regular']); setMultiplier('');
    setPin(''); setFlavorText(''); setSubjectText(''); setFrame(''); setBackground('');
    setCreating(false);
  };

  const save = () => {
    try {
      const tag = canonicalTag(label);
      if (!tag) { toast.error('Give the override a name.'); return; }
      if (builtInOverrideTags().has(tag)) { toast.error(`"${label.trim()}" is a built-in override.`); return; }
      const mult = multiplier.trim() ? Number(multiplier) : undefined;
      if (mult != null && (!Number.isFinite(mult) || mult <= 0)) { toast.error('Multiplier must be a positive number.'); return; }
      upsertOverride({
        tag, label: label.trim(), appliesTo,
        valueMultiplier: mult,
        pin: pin.trim() || undefined,
        flavorText: flavorText.trim() || undefined,
        subjectText: subjectText.trim() || undefined,
        frame: frame.trim() || undefined,
        background: background.trim() || undefined,
      });
      setMetas(loadOverrideMeta());
      toast.success(`Visual tag "${label.trim()}" saved.`);
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the override.');
    }
  };

  const remove = (tag: string) => {
    try {
      deleteOverride(tag);
      setMetas(loadOverrideMeta());
      toast.info('Visual tag removed.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove it.');
    }
  };

  return (
    <div className="space-y-5">
      {/* Custom overrides */}
      {metas.length > 0 ? (
        <div className="space-y-2">
          {metas.map(m => (
            <div key={m.tag} className="rounded-xl bg-white/[0.03] border border-white/5 px-3.5 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white flex items-center gap-2">
                  {m.pin && <span>{m.pin}</span>}{m.label}
                  {m.valueMultiplier && m.valueMultiplier !== 1 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-black">×{m.valueMultiplier}</span>
                  )}
                </p>
                <p className="text-[11px] text-white/40 truncate">
                  Extra copy allowed on: {m.appliesTo.join(', ')}{m.flavorText ? ` · “${m.flavorText}”` : ''}
                </p>
              </div>
              <Button variant="ghost" size="sm" disabled={disabled}
                className="rounded-full text-white/40 hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                onClick={() => remove(m.tag)} aria-label={`Delete ${m.label}`}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-white/40">No custom overrides yet.</p>
      )}

      {/* Create form */}
      {creating ? (
        <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Name</label>
              <input className={inputCls} value={label} onChange={e => setLabel(e.target.value)} placeholder="Summer Splash" data-testid="override-name" />
            </div>
            <div>
              <label className={labelCls}>Value multiplier (optional)</label>
              <input className={inputCls} value={multiplier} onChange={e => setMultiplier(e.target.value)} inputMode="decimal" placeholder="e.g. 10" data-testid="override-multiplier" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Allows an extra copy of</label>
            <div className="flex gap-2">
              {OVERRIDE_PRESENCES.map(p => (
                <button key={p}
                  onClick={() => setAppliesTo(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                  className={cn('px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border',
                    appliesTo.includes(p) ? 'bg-primary text-white border-primary' : 'bg-white/5 text-white/60 border-white/10')}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Pin (emoji / short text)</label>
              <input className={inputCls} value={pin} onChange={e => setPin(e.target.value)} placeholder="🌊" maxLength={12} />
            </div>
            <div>
              <label className={labelCls}>Frame style</label>
              <input className={inputCls} value={frame} onChange={e => setFrame(e.target.value)} placeholder="wave-gold" />
            </div>
            <div>
              <label className={labelCls}>Background</label>
              <input className={inputCls} value={background} onChange={e => setBackground(e.target.value)} placeholder="#0ea5e9 or style key" />
            </div>
            <div>
              <label className={labelCls}>Subject text</label>
              <input className={inputCls} value={subjectText} onChange={e => setSubjectText(e.target.value)} placeholder="Summer 2026" />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Flavor text</label>
              <input className={inputCls} value={flavorText} onChange={e => setFlavorText(e.target.value)} placeholder="Caught in the summer wave" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="rounded-full font-bold h-9 px-5" onClick={save} disabled={disabled} data-testid="override-save">
              <Check className="w-4 h-4 mr-1.5" /> Save override
            </Button>
            <Button variant="ghost" size="sm" className="rounded-full text-white/40 h-9" onClick={resetForm}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" disabled={disabled}
          className="rounded-full bg-white/5 border-white/10 hover:bg-white/10 text-white text-xs font-bold h-9"
          onClick={() => setCreating(true)} data-testid="override-create">
          <Plus className="w-3.5 h-3.5 mr-1.5" /> New visual tag
        </Button>
      )}

    </div>
  );
}

// ── Artist badges ─────────────────────────────────────────────────────────────

function BadgeManager({ disabled }: { disabled: boolean }) {
  const { songs } = useMusicKit();
  const [map, setMap] = useState(() => loadArtistBadges());
  const [artist, setArtist] = useState('');

  const artists = useMemo(
    () => [...new Map(songs.map(s => [artistKey(s.artist), s.artist])).values()].sort((a, b) => a.localeCompare(b)),
    [songs],
  );
  const assigned = artist ? (map[artistKey(artist)] ?? []) : [];
  const decorated = Object.entries(map);

  return (
    <div className="space-y-5">
      <div>
        <label className={labelCls}>Artist</label>
        <input className={inputCls} list="edit-artists" value={artist}
          onChange={e => setArtist(e.target.value)} placeholder="Pick or type an artist…"
          data-testid="badge-artist" />
        <datalist id="edit-artists">
          {artists.map(a => <option key={a} value={a} />)}
        </datalist>
      </div>

      {artist.trim() && (
        <div>
          <p className={labelCls}>Badges for {artist.trim()}</p>
          <div className="flex flex-wrap gap-2">
            {BADGE_TIERS.map(tier => {
              const active = assigned.includes(tier);
              return (
                <button key={tier} disabled={disabled}
                  onClick={() => setMap({ ...toggleArtistBadge(artist, tier) })}
                  data-testid={`badge-${tier}`}
                  className={cn('px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors disabled:opacity-50',
                    active ? 'text-black' : 'bg-white/5 text-white/60 border-white/10')}
                  style={active ? { background: BADGE_COLORS[tier], borderColor: BADGE_COLORS[tier] } : undefined}>
                  {BADGE_LABELS[tier]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {decorated.length > 0 && (
        <div>
          <p className={labelCls}>Decorated artists</p>
          <div className="space-y-1.5">
            {decorated.map(([key, tiers]) => {
              const display = artists.find(a => artistKey(a) === key) ?? key;
              return (
                <button key={key} className="w-full flex items-center gap-2 rounded-xl bg-white/[0.03] border border-white/5 px-3.5 py-2.5 text-left hover:bg-white/5"
                  onClick={() => setArtist(display)}>
                  <span className="text-sm font-bold text-white flex-1 truncate">{display}</span>
                  <span className="flex gap-1">
                    {tiers.map(t => (
                      <span key={t} className="w-2.5 h-2.5 rounded-full" style={{ background: BADGE_COLORS[t] }} title={BADGE_LABELS[t]} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EditMode() {
  const { conflicts, songs } = useMusicKit();

  // Card ids with media attached (for upload buttons + previews)
  const [mediaIds, setMediaIds] = useState<Set<string>>(new Set());
  const [mediaVersion, setMediaVersion] = useState(0);
  const refreshMedia = () => {
    listMediaCardIds().then(ids => { setMediaIds(new Set(ids)); setMediaVersion(v => v + 1); }).catch(() => {});
  };
  useEffect(refreshMedia, []);

  return (
    <div className="h-full overflow-y-auto bg-background pb-24">
      <div className="page-top px-4 sm:px-6 pb-8 space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <Link href="/settings" className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center shrink-0" aria-label="Back to Settings">
            <ArrowLeft className="w-5 h-5 text-white/70" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-display font-black tracking-tight text-white">Edit Mode</h1>
            <p className="text-sm text-white/50">Everything playlists can't express</p>
          </div>
        </div>

        <div className="space-y-4">
          <Section icon={Pencil} title="Songs" description="Edit a song's info, card tags, and card media" defaultOpen={songs.length > 0}>
            <SongEditor mediaIds={mediaIds} refreshMedia={refreshMedia} mediaVersion={mediaVersion} />
          </Section>

          <Section icon={Layers} title="Visual Tags" description="Custom visual tags for special card appearances">
            <OverrideManager disabled={false} />
          </Section>

          <Section icon={Tags} title="Tag Playlist Links" description="Link Apple Music playlists to any custom tag combination">
            <TagPlaylistLinkEditor />
          </Section>

          <Section icon={Award} title="Artist Badges" description="Assign accomplishment badges for artist pages">
            <BadgeManager disabled={false} />
          </Section>

          <Section icon={AlertTriangle} title="Conflicts" description="Copies that broke collection rules during import" count={conflicts.length} defaultOpen={conflicts.length > 0}>
            <ConflictQueue />
          </Section>
        </div>
      </div>
    </div>
  );
}
