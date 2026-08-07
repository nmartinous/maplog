import React, { useMemo, useState } from 'react';
import { useMusicKit } from '@/context/MusicKitContext';
import {
  loadPlaylistLinks, savePlaylistLinks, fetchPlaylist,
  LINKABLE_RARITIES, type PlaylistLinks, type PlaylistLink,
} from '@/lib/playlistLinks';
import type { MaplogCard, MaplogRarityType, MaplogSong } from '@/lib/types';
import {
  ListMusic, RefreshCw, Link2, X, Loader2, CheckCircle2, XCircle,
  AlertTriangle, Copy,
} from 'lucide-react';
import { Link } from 'wouter';
import { conflictLine, type TagConflict } from '@/lib/conflicts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { EpicImportWizard, type WizardItem } from '@/components/EpicImportWizard';

/** Epic playlist slugs that prompt for numbered / canvas decisions on import */
const NUMBERED_EPIC_SLUGS = new Set(['epic-common', 'epic-uncommon', 'epic-rare']);
const EPIC_WIZARD_SLUGS   = new Set(['epic-common', 'epic-uncommon', 'epic-rare', 'epic-unnumbered']);

/** Tags that indicate an epic card has been through the setup wizard */
const EPIC_SETUP_TAGS = new Set(['canvas', 'parallax']);

// ── Per-rarity accent colors (matches card rarity palette) ────────────────────
const RARITY_ACCENT: Record<string, string> = {
  'regular-common':   'from-zinc-500/20 to-zinc-700/10 text-zinc-300',
  'regular-uncommon': 'from-emerald-500/20 to-emerald-700/10 text-emerald-300',
  'regular-rare':     'from-sky-500/20 to-sky-700/10 text-sky-300',
  'shiny-common':     'from-teal-400/20 to-fuchsia-500/10 text-teal-200',
  'shiny-uncommon':   'from-fuchsia-400/20 to-cyan-500/10 text-fuchsia-200',
  'shiny-rare':       'from-amber-400/20 to-violet-500/10 text-amber-200',
  // ── Epic playlists ──
  'epic-common':      'from-green-500/25 to-green-700/10 text-green-300',
  'epic-uncommon':    'from-purple-500/25 to-purple-700/10 text-purple-300',
  'epic-rare':        'from-yellow-400/20 to-pink-500/10 text-yellow-200',
  'epic-unnumbered':  'from-white/10 to-white/5 text-white/70',
};

type SyncSummary = {
  rarity: string; added: number; removed: number; error?: string;
  /** What Apple's public snapshot actually returned — distinguishes "Apple hasn't propagated your edits yet" from a sync bug. */
  trackTotal?: number; lastModified?: string | null;
}[];

/**
 * Rarity ↔ Apple Music playlist linking + one-tap "Refresh all" sync.
 * Lives in Settings; the Playlists tab is for user-created playlists.
 */
export function RarityPlaylistSync() {
  const { songs, syncRarity, runConflictScan, updateCardMeta, updateCardTags } = useMusicKit();
  const [conflictReport, setConflictReport] = useState<TagConflict[] | null>(null);

  const [links, setLinks] = useState<PlaylistLinks>(() => loadPlaylistLinks());
  const [linkingSlug, setLinkingSlug] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [summary, setSummary] = useState<SyncSummary | null>(null);
  const [wizardItems, setWizardItems] = useState<WizardItem[] | null>(null);

  const linkedCount = LINKABLE_RARITIES.filter(r => links[r.slug]).length;

  const songsAtRarity = useMemo(() => {
    const map = new Map<string, MaplogSong[]>();
    for (const r of LINKABLE_RARITIES) {
      map.set(r.slug, songs.filter(s => s.cards.some(c => c.rarityType.slug === r.slug)));
    }
    return map;
  }, [songs]);

  const updateLinks = (next: PlaylistLinks) => {
    setLinks(next);
    savePlaylistLinks(next);
  };

  // ── Link / unlink ───────────────────────────────────────────────────────────

  const handleLink = async (rarity: MaplogRarityType) => {
    setLinkError(null);
    setLinkBusy(true);
    try {
      const { name, songs: tracks } = await fetchPlaylist(urlInput);
      const link: PlaylistLink = {
        raritySlug: rarity.slug,
        url: urlInput.trim(),
        name,
        trackCount: tracks.length,
        artworkUrl: tracks[0]?.artworkUrl || null,
        lastSynced: null,
      };
      updateLinks({ ...links, [rarity.slug]: link });
      setLinkingSlug(null);
      setUrlInput('');
      toast.success(`Linked "${name}" to ${rarity.name}`);
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : 'Could not load the playlist.');
    } finally {
      setLinkBusy(false);
    }
  };

  const handleUnlink = (rarity: MaplogRarityType) => {
    if (!confirm(`Unlink the ${rarity.name} playlist? Your collection is not changed.`)) return;
    const next = { ...links };
    delete next[rarity.slug];
    updateLinks(next);
  };

  // ── Sync ────────────────────────────────────────────────────────────────────

  const syncOne = async (
    rarity: MaplogRarityType,
    link: PlaylistLink,
  ): Promise<SyncSummary[number] & { addedSongs: MaplogSong[] }> => {
    try {
      const { name, lastModified, songs: tracks } = await fetchPlaylist(link.url);
      const { added, removed, addedSongs } = syncRarity(rarity, tracks);
      updateLinksRef.current = {
        ...updateLinksRef.current,
        [rarity.slug]: { ...link, name, trackCount: tracks.length, artworkUrl: tracks[0]?.artworkUrl || link.artworkUrl, lastSynced: new Date().toISOString() },
      };
      return { rarity: rarity.name, added, removed, addedSongs, trackTotal: tracks.length, lastModified };
    } catch (err) {
      return { rarity: rarity.name, added: 0, removed: 0, addedSongs: [], error: err instanceof Error ? err.message : 'Sync failed' };
    }
  };

  // Accumulate link updates across the sequential sync loop
  const updateLinksRef = React.useRef(links);
  React.useEffect(() => { updateLinksRef.current = links; }, [links]);

  const handleRefreshAll = async () => {
    const targets = LINKABLE_RARITIES.filter(r => links[r.slug]);
    if (targets.length === 0) { toast.info('Link a playlist first.'); return; }
    setSyncing(true);
    setSummary(null);
    const results: (SyncSummary[number] & { addedSongs: MaplogSong[] })[] = [];
    for (const rarity of targets) {
      results.push(await syncOne(rarity, updateLinksRef.current[rarity.slug]));
    }
    updateLinks(updateLinksRef.current);
    setSummary(results);
    // Validate tag rules across the refreshed collection: dedupe exact
    // duplicates silently, pull rule-breaking copies into the conflict queue.
    const scan = runConflictScan();
    setConflictReport(scan.newConflicts.length > 0 ? scan.newConflicts : null);
    setSyncing(false);
    const totalAdded = results.reduce((n, r) => n + r.added, 0);
    const totalRemoved = results.reduce((n, r) => n + r.removed, 0);
    const failed = results.filter(r => r.error).length;
    if (failed === results.length) toast.error('Sync failed — check your playlist links.');
    else if (failed > 0) toast.warning(`Partially synced: +${totalAdded} added, −${totalRemoved} removed; ${failed} playlist${failed !== 1 ? 's' : ''} failed.`);
    else if (totalAdded === 0 && totalRemoved === 0) toast.success('Everything is already in sync.');
    else toast.success(`Synced: +${totalAdded} added, −${totalRemoved} removed.`);

    // Build wizard items: newly imported epics + existing epics missing canvas/parallax tag
    const wizItems: WizardItem[] = [];
    const newlyAddedIds = new Set<string>();
    for (const result of results) {
      for (const song of result.addedSongs) {
        for (const card of song.cards) {
          if (!EPIC_WIZARD_SLUGS.has(card.rarityType.slug)) continue;
          newlyAddedIds.add(card.id);
          wizItems.push({
            song,
            card,
            isNumbered: NUMBERED_EPIC_SLUGS.has(card.rarityType.slug),
          });
        }
      }
    }
    // Also catch existing epic cards that somehow skipped wizard setup
    for (const song of songs) {
      for (const card of song.cards) {
        if (!EPIC_WIZARD_SLUGS.has(card.rarityType.slug)) continue;
        if (newlyAddedIds.has(card.id)) continue; // already queued
        const hasSetupTag = (card.tags ?? []).some(t => EPIC_SETUP_TAGS.has(t));
        if (hasSetupTag) continue;
        wizItems.push({
          song,
          card,
          isNumbered: NUMBERED_EPIC_SLUGS.has(card.rarityType.slug),
        });
      }
    }
    if (wizItems.length > 0) setWizardItems(wizItems);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 px-2">
        <p className="text-sm text-white/50">One Apple Music playlist per rarity</p>
        <Button
          onClick={handleRefreshAll}
          disabled={syncing || linkedCount === 0}
          size="sm"
          className="rounded-full font-bold h-10 px-4 shrink-0 shadow-lg"
        >
          {syncing
            ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Syncing…</span>
            : <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Refresh all</span>}
        </Button>
      </div>

      <AnimatePresence>
        {conflictReport && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 px-5 py-4 space-y-3 relative">
              <button className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center" onClick={() => setConflictReport(null)} aria-label="Dismiss conflicts">
                <X className="w-4 h-4 text-white/60" />
              </button>
              <p className="text-xs font-bold uppercase tracking-widest text-amber-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {conflictReport.length} conflict{conflictReport.length !== 1 ? 's' : ''} found
              </p>
              <div className="space-y-1.5">
                {conflictReport.map(c => (
                  <p key={c.id} className="text-sm text-white/80 leading-snug">{conflictLine(c)}</p>
                ))}
              </div>
              <p className="text-xs text-white/50">
                Both copies were removed from your collection. Fix your Apple Music playlists and refresh again, or resolve them here.
              </p>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm"
                  className="rounded-full bg-white/5 border-white/10 hover:bg-white/10 text-white text-xs font-bold h-9"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(conflictReport.map(conflictLine).join('\n'));
                      toast.success('Conflict list copied.');
                    } catch { toast.error('Could not copy to the clipboard.'); }
                  }}>
                  <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy
                </Button>
                <Link href="/conflicts" className="flex-1">
                  <Button size="sm" className="rounded-full font-bold h-9 w-full text-xs">Resolve conflicts</Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
        {summary && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl bg-white/5 border border-white/10 px-5 py-4 space-y-2 relative">
              <button className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center" onClick={() => setSummary(null)} aria-label="Dismiss summary">
                <X className="w-4 h-4 text-white/60" />
              </button>
              <p className="text-xs font-bold uppercase tracking-widest text-white/50">Last sync</p>
              {summary.map(r => (
                <div key={r.rarity} className="text-sm space-y-0.5">
                  <div className="flex items-center gap-2">
                    {r.error
                      ? <XCircle className="w-4 h-4 text-destructive shrink-0" />
                      : <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
                    <span className="font-bold text-white">{r.rarity}:</span>
                    {r.error
                      ? <span className="text-destructive text-xs">{r.error}</span>
                      : <span className="text-white/60">{r.added} added, {r.removed} removed</span>}
                  </div>
                  {!r.error && r.trackTotal != null && (
                    <p className="pl-6 text-xs text-white/40">
                      Apple returned {r.trackTotal} track{r.trackTotal !== 1 ? 's' : ''}
                      {r.lastModified && ` · playlist snapshot updated ${new Date(r.lastModified).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`}
                    </p>
                  )}
                </div>
              ))}
              <p className="text-[11px] leading-snug text-white/35">
                If a song you just added is missing but the snapshot date is old, Apple hasn't published your edit yet — shared playlists can take a while to update. Try again later.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {LINKABLE_RARITIES.map((rarity, i) => {
          const link = links[rarity.slug];
          const owned = songsAtRarity.get(rarity.slug) ?? [];
          const isLinking = linkingSlug === rarity.slug;
          const accent = RARITY_ACCENT[rarity.slug] ?? 'from-white/10 to-white/5 text-white';
          // Section divider before the first epic playlist entry
          const showEpicDivider = i > 0 && rarity.slug === 'epic-common';

          return (
            <React.Fragment key={rarity.slug}>
            {showEpicDivider && (
              <div className="flex items-center gap-3 px-1 pt-2">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Epic Playlists</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>
            )}
            <div className="glass-panel rounded-[2rem] overflow-hidden relative">
              <div className={cn('absolute inset-0 bg-gradient-to-br opacity-60 pointer-events-none', accent.split(' ').slice(0, 2).join(' '))} />

              <div className="relative z-10 p-5">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 shadow-lg border border-white/10 bg-white/5">
                    {link?.artworkUrl
                      ? <img src={link.artworkUrl} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><ListMusic className={cn('w-6 h-6', accent.split(' ').pop())} /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-[10px] font-black uppercase tracking-[0.2em] mb-0.5', accent.split(' ').pop())}>{rarity.name}</p>
                    {link ? (
                      <>
                        <p className="font-display font-bold text-base text-white truncate leading-tight">{link.name}</p>
                        <p className="text-xs text-white/50 mt-0.5">
                          {link.trackCount} track{link.trackCount !== 1 ? 's' : ''} · {owned.length} in collection
                          {link.lastSynced && ` · synced ${new Date(link.lastSynced).toLocaleDateString()}`}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-display font-bold text-base text-white/60 leading-tight">No playlist linked</p>
                        <p className="text-xs text-white/40 mt-0.5">{owned.length} song{owned.length !== 1 ? 's' : ''} at this rarity</p>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  {link ? (
                    <>
                      <Button variant="outline" size="sm"
                        className="rounded-full bg-white/5 border-white/10 hover:bg-white/10 text-white text-xs font-bold h-9"
                        onClick={() => { setLinkingSlug(isLinking ? null : rarity.slug); setUrlInput(link.url); setLinkError(null); }}>
                        <Link2 className="w-3.5 h-3.5 mr-1.5" /> Replace link
                      </Button>
                      <Button variant="ghost" size="sm"
                        className="rounded-full text-white/40 hover:text-destructive hover:bg-destructive/10 text-xs font-bold h-9"
                        onClick={() => handleUnlink(rarity)}>
                        <X className="w-3.5 h-3.5 mr-1" /> Unlink
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" size="sm"
                      className="rounded-full bg-white/5 border-white/10 hover:bg-white/10 text-white text-xs font-bold h-9"
                      onClick={() => { setLinkingSlug(isLinking ? null : rarity.slug); setUrlInput(''); setLinkError(null); }}>
                      <Link2 className="w-3.5 h-3.5 mr-1.5" /> Link a playlist
                    </Button>
                  )}
                </div>

                <AnimatePresence>
                  {isLinking && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-4 space-y-3">
                        <input
                          type="url" inputMode="url" autoFocus
                          className="w-full h-11 rounded-2xl bg-black/30 border border-white/10 px-4 text-sm font-mono text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-primary/50"
                          placeholder="https://music.apple.com/us/playlist/…"
                          value={urlInput} onChange={e => setUrlInput(e.target.value)}
                        />
                        {linkError && (
                          <p className="flex items-start gap-2 text-xs text-destructive"><XCircle className="w-4 h-4 shrink-0" /> {linkError}</p>
                        )}
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" className="rounded-full text-white/50 h-9" onClick={() => { setLinkingSlug(null); setLinkError(null); }}>
                            Cancel
                          </Button>
                          <Button size="sm" className="rounded-full font-bold h-9 flex-1"
                            disabled={linkBusy || !urlInput.trim().includes('music.apple.com')}
                            onClick={() => handleLink(rarity)}>
                            {linkBusy
                              ? <span className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</span>
                              : 'Link playlist'}
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Epic import wizard — appears after sync when new/unconfigured epic cards need setup */}
      {wizardItems && (
        <EpicImportWizard
          items={wizardItems}
          onSave={(songId, cardId, label, isCanvas) => {
            // Save number label
            updateCardMeta(songId, cardId, { variantLabel: label });
            // Add canvas or parallax tag to the card's existing tag pool
            const song = songs.find(s => s.id === songId);
            const card = song?.cards.find(c => c.id === cardId);
            if (card) {
              const existingTags = (card.tags ?? []).filter(t => !EPIC_SETUP_TAGS.has(t));
              updateCardTags(songId, cardId, [...existingTags, isCanvas ? 'canvas' : 'parallax']);
            }
          }}
          onDone={() => setWizardItems(null)}
        />
      )}
    </div>
  );
}
