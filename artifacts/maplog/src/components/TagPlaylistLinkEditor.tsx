import React, { useState, useCallback } from 'react';
import { useMusicKit } from '@/context/MusicKitContext';
import {
  loadPlaylistLinks, savePlaylistLinks, fetchPlaylist,
  type PlaylistLinks, type PlaylistLink,
} from '@/lib/playlistLinks';
import { normalizeTags, labelForTags, sameTagPool, loadTagRules } from '@/lib/tags';
import type { MaplogSong, MaplogCard, MaplogRarityType } from '@/lib/types';
import { TagChipPicker } from '@/components/TagChipPicker';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Link2, X, Loader2, RefreshCw, ListMusic, ChevronDown, Plus,
  CheckCircle2, XCircle, Sparkles,
} from 'lucide-react';

// ── Storage key ────────────────────────────────────────────────────────────────

const COLLECTION_KEY = 'maplog:collection';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Build a stable key for a tag-based playlist link. */
export function tagLinkKey(tags: string[]): string {
  return `tags:${normalizeTags(tags).join('+')}`;
}

/** Derive a synthetic rarity tier from a tag set (for card sorting). */
function tierFromTags(tags: string[]): number {
  const t = new Set(tags);
  if (t.has('radiant')) return 10;
  if (t.has('lyrics')) return 9;
  if (t.has('moment')) return 8;
  if (t.has('epic')) return 7;
  if (t.has('shiny')) return t.has('rare') ? 6 : t.has('uncommon') ? 5 : 4;
  if (t.has('rare')) return 3;
  if (t.has('uncommon')) return 2;
  return 1;
}

const normKey = (s: { title: string; artist: string }) =>
  `${s.title.trim().toLowerCase()}|${s.artist.trim().toLowerCase()}`;

/**
 * Sync a tag-based playlist link against the local collection.
 * Writes directly to localStorage and then calls refresh() to update context.
 */
async function syncTagLink(
  link: PlaylistLink & { tags: string[] },
  refreshContext: () => void,
): Promise<{ added: number; skipped: number }> {
  const { songs: tracks } = await fetchPlaylist(link.url);

  let collection: MaplogSong[] = [];
  try {
    const raw = localStorage.getItem(COLLECTION_KEY);
    collection = raw ? JSON.parse(raw) : [];
  } catch { collection = []; }

  const byId = new Map(collection.map(s => [s.id, s]));
  const byTitleArtist = new Map<string, MaplogSong>();
  for (const s of collection) {
    const k = normKey(s);
    if (!byTitleArtist.has(k)) byTitleArtist.set(k, s);
  }

  const tagsNorm = normalizeTags(link.tags);
  const tagsKey = tagsNorm.join('+');
  const syntheticRarity: MaplogRarityType = {
    slug: `tags:${tagsKey}`,
    name: labelForTags(link.tags),
    category: 'custom',
    tier: tierFromTags(tagsNorm),
  };

  let added = 0, skipped = 0;

  for (const track of tracks) {
    const existing = byId.get(track.id) ?? byTitleArtist.get(normKey(track)) ?? null;

    if (existing) {
      const live = byId.get(existing.id)!;
      const hasCard = live.cards.some(c => sameTagPool(normalizeTags(c.tags ?? []), tagsNorm));
      if (hasCard) { skipped++; continue; }

      const newCard: MaplogCard = {
        id: `${live.id}::tags:${tagsKey}`,
        artworkUrl: track.artworkUrl || live.artworkUrl,
        rarityType: syntheticRarity,
        variantLabel: null,
        tags: tagsNorm,
      };
      byId.set(existing.id, {
        ...live,
        cards: [...live.cards, newCard].sort((a, b) => b.rarityType.tier - a.rarityType.tier),
      });
      added++;
    } else {
      // New song — not yet in collection
      const newCard: MaplogCard = {
        id: `${track.id}::tags:${tagsKey}`,
        artworkUrl: track.artworkUrl,
        rarityType: syntheticRarity,
        variantLabel: null,
        tags: tagsNorm,
      };
      byId.set(track.id, { ...track, cards: [newCard] });
      added++;
    }
  }

  const updated = [...byId.values()].sort((a, b) => a.title.localeCompare(b.title));
  localStorage.setItem(COLLECTION_KEY, JSON.stringify(updated));
  refreshContext();

  return { added, skipped };
}

// ── Tag chip display (read-only) ───────────────────────────────────────────────

function TagChip({ tag }: { tag: string }) {
  const CAP: Record<string, string> = {
    day1: 'Day 1', week1: 'Week 1', aprilfools: 'April Fools',
    summersplash: 'Summer Splash', pridemap: 'Pridemap',
  };
  const display = CAP[tag] ?? tag.charAt(0).toUpperCase() + tag.slice(1);
  return (
    <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/70 text-[10px] font-bold">
      {display}
    </span>
  );
}

// ── Saved link card ────────────────────────────────────────────────────────────

function TagLinkCard({
  linkKey, link, disabled, onUnlink, onRefresh,
}: {
  linkKey: string;
  link: PlaylistLink & { tags: string[] };
  disabled: boolean;
  onUnlink: (key: string) => void;
  onRefresh: (key: string, link: PlaylistLink & { tags: string[] }) => void;
}) {
  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/10 overflow-hidden">
      <div className="p-4 flex items-start gap-3">
        {/* Artwork */}
        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-white/10 bg-white/5">
          {link.artworkUrl
            ? <img src={link.artworkUrl} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center"><ListMusic className="w-5 h-5 text-white/30" /></div>}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-white truncate leading-tight">{link.name}</p>
          <p className="text-[11px] text-white/40 mt-0.5">
            {link.trackCount} track{link.trackCount !== 1 ? 's' : ''}
            {link.lastSynced && ` · synced ${new Date(link.lastSynced).toLocaleDateString()}`}
          </p>
          <div className="flex flex-wrap gap-1 mt-2">
            {link.tags.map(t => <TagChip key={t} tag={t} />)}
          </div>
        </div>
      </div>

      <div className="border-t border-white/5 px-4 py-3 flex gap-2">
        <Button variant="outline" size="sm"
          disabled={disabled}
          className="rounded-full bg-white/5 border-white/10 hover:bg-white/10 text-white text-xs font-bold h-8"
          onClick={() => onRefresh(linkKey, link)}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
        </Button>
        <Button variant="ghost" size="sm"
          disabled={disabled}
          className="rounded-full text-white/40 hover:text-destructive hover:bg-destructive/10 text-xs font-bold h-8"
          onClick={() => onUnlink(linkKey)}>
          <X className="w-3.5 h-3.5 mr-1" /> Unlink
        </Button>
      </div>
    </div>
  );
}

// ── TagPlaylistLinkEditor ──────────────────────────────────────────────────────

const inputCls = 'w-full h-11 rounded-xl bg-white/5 border border-white/10 px-3.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-primary/50';
const labelCls = 'text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5 block';

export function TagPlaylistLinkEditor() {
  const { isDemoMode, refresh } = useMusicKit();

  const [links, setLinks] = useState<PlaylistLinks>(() => loadPlaylistLinks());

  // ── Form state ────────────────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Per-link refresh state ────────────────────────────────────────────────
  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({});

  const updateLinks = useCallback((next: PlaylistLinks) => {
    setLinks(next);
    savePlaylistLinks(next);
  }, []);

  // Tag-based links: keys starting with "tags:"
  const tagLinks = Object.entries(links)
    .filter(([k]) => k.startsWith('tags:'))
    .map(([k, v]) => ({ key: k, link: v as PlaylistLink & { tags: string[] } }));

  // ── Save new link ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (isDemoMode) return;
    setSaveError(null);
    setSaving(true);
    try {
      const { name, songs: tracks } = await fetchPlaylist(urlInput);
      const tagsNorm = normalizeTags(selectedTags);
      const key = tagLinkKey(tagsNorm);
      const link: PlaylistLink = {
        raritySlug: key,
        url: urlInput.trim(),
        name: displayName.trim() || name,
        trackCount: tracks.length,
        artworkUrl: tracks[0]?.artworkUrl ?? null,
        lastSynced: null,
        tags: tagsNorm,
      };
      updateLinks({ ...links, [key]: link });
      toast.success(`Tag playlist "${link.name}" saved.`);
      setShowForm(false);
      setSelectedTags([]);
      setUrlInput('');
      setDisplayName('');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not load the playlist.');
    } finally {
      setSaving(false);
    }
  };

  // ── Unlink ────────────────────────────────────────────────────────────────
  const handleUnlink = (key: string) => {
    if (isDemoMode) return;
    const link = links[key];
    if (!confirm(`Unlink "${link?.name ?? key}"? Your collection is not changed.`)) return;
    const next = { ...links };
    delete next[key];
    updateLinks(next);
  };

  // ── Refresh / sync ────────────────────────────────────────────────────────
  const handleRefresh = async (key: string, link: PlaylistLink & { tags: string[] }) => {
    if (isDemoMode) { toast.info('Demo mode is read-only — exit demo mode to sync.'); return; }
    setRefreshing(r => ({ ...r, [key]: true }));
    try {
      // Re-fetch playlist to update metadata + sync
      const { name, songs: tracks } = await fetchPlaylist(link.url);
      const updatedLink: PlaylistLink = {
        ...link,
        name: link.name, // keep user-set name
        trackCount: tracks.length,
        artworkUrl: tracks[0]?.artworkUrl ?? link.artworkUrl,
        lastSynced: new Date().toISOString(),
      };
      updateLinks({ ...loadPlaylistLinks(), [key]: updatedLink });

      const { added, skipped } = await syncTagLink({ ...updatedLink, tags: link.tags }, refresh);
      // Reload links from storage to pick up the update
      setLinks(loadPlaylistLinks());

      if (added === 0 && skipped > 0) {
        toast.success('Everything is already in sync.');
      } else {
        toast.success(`Synced: +${added} added, ${skipped} already present.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed.');
    } finally {
      setRefreshing(r => ({ ...r, [key]: false }));
    }
  };

  const canSave = selectedTags.length > 0 && urlInput.trim().includes('music.apple.com');

  return (
    <div className="space-y-4">
      {isDemoMode && (
        <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 flex items-center gap-3">
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <p className="text-xs text-white/60">Demo mode is read-only — playlist syncing is disabled.</p>
        </div>
      )}

      {/* Existing tag links */}
      {tagLinks.length > 0 && (
        <div className="space-y-3">
          {tagLinks.map(({ key, link }) => (
            <div key={key} className="relative">
              {refreshing[key] && (
                <div className="absolute inset-0 rounded-2xl bg-black/40 z-10 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-white/70" />
                  <span className="text-xs text-white/70 font-bold">Syncing…</span>
                </div>
              )}
              <TagLinkCard
                linkKey={key}
                link={link}
                disabled={isDemoMode || !!refreshing[key]}
                onUnlink={handleUnlink}
                onRefresh={handleRefresh}
              />
            </div>
          ))}
        </div>
      )}

      {/* New link form (collapsible) */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden">
        <button
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/5 transition-colors"
          onClick={() => { setShowForm(o => !o); setSaveError(null); }}
          disabled={isDemoMode}
        >
          <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center">
            <Plus className="w-4 h-4 text-white/50" />
          </div>
          <span className="text-sm font-bold text-white/70 flex-1">New Tag Playlist Link</span>
          <ChevronDown className={cn('w-4 h-4 text-white/30 transition-transform duration-200', showForm ? 'rotate-180' : '')} />
        </button>

        <AnimatePresence initial={false}>
          {showForm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
              className="overflow-hidden"
            >
              <div className="border-t border-white/5 px-4 py-4 space-y-4">
                {/* Tag picker */}
                <div>
                  <label className={labelCls}>Tags for imported cards</label>
                  <TagChipPicker selected={selectedTags} onChange={setSelectedTags} />
                  {selectedTags.length > 0 && (
                    <p className="text-[11px] text-white/40 mt-2">
                      Cards will be tagged: <span className="text-white/60 font-mono">{normalizeTags(selectedTags).join(' · ')}</span>
                    </p>
                  )}
                </div>

                {/* URL */}
                <div>
                  <label className={labelCls}>Apple Music Playlist URL</label>
                  <input
                    type="url"
                    inputMode="url"
                    className={inputCls}
                    placeholder="https://music.apple.com/us/playlist/…"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                  />
                </div>

                {/* Display name (optional) */}
                <div>
                  <label className={labelCls}>Display name (optional — defaults to playlist name)</label>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="Leave blank to use the playlist's name"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                  />
                </div>

                {/* Error */}
                {saveError && (
                  <div className="flex items-start gap-2 text-xs text-destructive">
                    <XCircle className="w-4 h-4 shrink-0" /> {saveError}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm"
                    className="rounded-full text-white/50 h-9"
                    onClick={() => { setShowForm(false); setSaveError(null); }}>
                    Cancel
                  </Button>
                  <Button size="sm"
                    className="rounded-full font-bold h-9 flex-1"
                    disabled={saving || !canSave || isDemoMode}
                    onClick={handleSave}>
                    {saving
                      ? <span className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</span>
                      : <span className="flex items-center gap-2"><Link2 className="w-3.5 h-3.5" /> Save link</span>}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
