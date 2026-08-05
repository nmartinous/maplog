import React, { useMemo, useState } from 'react';
import { useMusicKit } from '@/context/MusicKitContext';
import { usePlayer } from '@/context/AudioPlayerContext';
import {
  loadPlaylistLinks, savePlaylistLinks, fetchPlaylist,
  LINKABLE_RARITIES, type PlaylistLinks, type PlaylistLink,
} from '@/lib/playlistLinks';
import type { MaplogRarityType, MaplogSong } from '@/lib/types';
import {
  ListMusic, Play, RefreshCw, Link2, X, Loader2, CheckCircle2,
  XCircle, Music2, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// ── Per-rarity accent colors (matches card rarity palette) ────────────────────
const RARITY_ACCENT: Record<string, string> = {
  'regular-common':   'from-zinc-500/20 to-zinc-700/10 text-zinc-300',
  'regular-uncommon': 'from-emerald-500/20 to-emerald-700/10 text-emerald-300',
  'regular-rare':     'from-sky-500/20 to-sky-700/10 text-sky-300',
};

type SyncSummary = { rarity: string; added: number; removed: number; error?: string }[];

export default function Playlists() {
  const { songs, syncRarity, isDemoMode } = useMusicKit();
  const { play } = usePlayer();

  const [links, setLinks] = useState<PlaylistLinks>(() => loadPlaylistLinks());
  const [linkingSlug, setLinkingSlug] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [summary, setSummary] = useState<SyncSummary | null>(null);

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
    if (isDemoMode) return;
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
    if (isDemoMode) return;
    if (!confirm(`Unlink the ${rarity.name} playlist? Your collection is not changed.`)) return;
    const next = { ...links };
    delete next[rarity.slug];
    updateLinks(next);
  };

  // ── Sync ────────────────────────────────────────────────────────────────────

  const syncOne = async (rarity: MaplogRarityType, link: PlaylistLink): Promise<SyncSummary[number]> => {
    try {
      const { name, songs: tracks } = await fetchPlaylist(link.url);
      const { added, removed } = syncRarity(rarity, tracks);
      updateLinksRef.current = {
        ...updateLinksRef.current,
        [rarity.slug]: { ...link, name, trackCount: tracks.length, artworkUrl: tracks[0]?.artworkUrl || link.artworkUrl, lastSynced: new Date().toISOString() },
      };
      return { rarity: rarity.name, added, removed };
    } catch (err) {
      return { rarity: rarity.name, added: 0, removed: 0, error: err instanceof Error ? err.message : 'Sync failed' };
    }
  };

  // Accumulate link updates across the sequential sync loop
  const updateLinksRef = React.useRef(links);
  React.useEffect(() => { updateLinksRef.current = links; }, [links]);

  const handleRefreshAll = async () => {
    if (isDemoMode) { toast.info('Demo mode is read-only — exit demo mode to sync.'); return; }
    const targets = LINKABLE_RARITIES.filter(r => links[r.slug]);
    if (targets.length === 0) { toast.info('Link a playlist first.'); return; }
    setSyncing(true);
    setSummary(null);
    const results: SyncSummary = [];
    for (const rarity of targets) {
      results.push(await syncOne(rarity, updateLinksRef.current[rarity.slug]));
    }
    updateLinks(updateLinksRef.current);
    setSummary(results);
    setSyncing(false);
    const totalAdded = results.reduce((n, r) => n + r.added, 0);
    const totalRemoved = results.reduce((n, r) => n + r.removed, 0);
    const failed = results.filter(r => r.error).length;
    if (failed === results.length) toast.error('Sync failed — check your playlist links.');
    else if (failed > 0) toast.warning(`Partially synced: +${totalAdded} added, −${totalRemoved} removed; ${failed} playlist${failed !== 1 ? 's' : ''} failed.`);
    else if (totalAdded === 0 && totalRemoved === 0) toast.success('Everything is already in sync.');
    else toast.success(`Synced: +${totalAdded} added, −${totalRemoved} removed.`);
  };

  // ── Play ────────────────────────────────────────────────────────────────────

  const handlePlay = (rarity: MaplogRarityType) => {
    const list = songsAtRarity.get(rarity.slug) ?? [];
    if (list.length === 0) { toast.info('No songs at this rarity yet — refresh to sync.'); return; }
    play(list[0], list);
  };

  return (
    <div className="h-full overflow-y-auto bg-background pb-20">
      <div className="px-4 sm:px-6 pt-8 pb-6 relative z-10 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-black tracking-tight text-white">Playlists</h1>
          <p className="text-sm text-white/50 mt-1">One Apple Music playlist per rarity</p>
        </div>
        <Button
          onClick={handleRefreshAll}
          disabled={syncing || linkedCount === 0 || isDemoMode}
          className="rounded-full font-bold h-11 px-5 shrink-0 shadow-lg"
        >
          {syncing
            ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Syncing…</span>
            : <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Refresh all</span>}
        </Button>
      </div>

      {isDemoMode && (
        <div className="mx-4 sm:mx-6 mb-4 rounded-2xl bg-white/5 border border-white/10 px-4 py-3 flex items-center gap-3">
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <p className="text-xs text-white/60">Demo mode is read-only — playlist syncing is disabled.</p>
        </div>
      )}

      <AnimatePresence>
        {summary && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="mx-4 sm:mx-6 mb-4 overflow-hidden"
          >
            <div className="rounded-2xl bg-white/5 border border-white/10 px-5 py-4 space-y-2 relative">
              <button className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center" onClick={() => setSummary(null)} aria-label="Dismiss summary">
                <X className="w-4 h-4 text-white/60" />
              </button>
              <p className="text-xs font-bold uppercase tracking-widest text-white/50">Last sync</p>
              {summary.map(r => (
                <div key={r.rarity} className="flex items-center gap-2 text-sm">
                  {r.error
                    ? <XCircle className="w-4 h-4 text-destructive shrink-0" />
                    : <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
                  <span className="font-bold text-white">{r.rarity}:</span>
                  {r.error
                    ? <span className="text-destructive text-xs">{r.error}</span>
                    : <span className="text-white/60">{r.added} added, {r.removed} removed</span>}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-4 sm:px-6 space-y-4">
        {LINKABLE_RARITIES.map((rarity, index) => {
          const link = links[rarity.slug];
          const owned = songsAtRarity.get(rarity.slug) ?? [];
          const isLinking = linkingSlug === rarity.slug;
          const accent = RARITY_ACCENT[rarity.slug] ?? 'from-white/10 to-white/5 text-white';

          return (
            <motion.div
              key={rarity.slug}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.07, type: 'spring', damping: 20 }}
              className="glass-panel rounded-[2rem] overflow-hidden relative"
            >
              <div className={cn('absolute inset-0 bg-gradient-to-br opacity-60 pointer-events-none', accent.split(' ').slice(0, 2).join(' '))} />

              <div className="relative z-10 p-5">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 shadow-lg border border-white/10 bg-white/5">
                    {link?.artworkUrl
                      ? <img src={link.artworkUrl} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><ListMusic className={cn('w-7 h-7', accent.split(' ').pop())} /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-[10px] font-black uppercase tracking-[0.2em] mb-0.5', accent.split(' ').pop())}>{rarity.name}</p>
                    {link ? (
                      <>
                        <p className="font-display font-bold text-lg text-white truncate leading-tight">{link.name}</p>
                        <p className="text-xs text-white/50 mt-0.5">
                          {link.trackCount} track{link.trackCount !== 1 ? 's' : ''} · {owned.length} in collection
                          {link.lastSynced && ` · synced ${new Date(link.lastSynced).toLocaleDateString()}`}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-display font-bold text-lg text-white/60 leading-tight">No playlist linked</p>
                        <p className="text-xs text-white/40 mt-0.5">{owned.length} song{owned.length !== 1 ? 's' : ''} at this rarity</p>
                      </>
                    )}
                  </div>
                  {link && (
                    <Button
                      size="icon"
                      className="w-12 h-12 rounded-full shrink-0 bg-white text-black hover:bg-white/90 hover:scale-105 active:scale-95 transition-all shadow-lg"
                      onClick={() => handlePlay(rarity)}
                      aria-label={`Play ${rarity.name} playlist`}
                    >
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    </Button>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-2">
                  {link ? (
                    <>
                      <Button variant="outline" size="sm"
                        className="rounded-full bg-white/5 border-white/10 hover:bg-white/10 text-white text-xs font-bold h-9"
                        disabled={isDemoMode}
                        onClick={() => { setLinkingSlug(isLinking ? null : rarity.slug); setUrlInput(link.url); setLinkError(null); }}>
                        <Link2 className="w-3.5 h-3.5 mr-1.5" /> Replace link
                      </Button>
                      <Button variant="ghost" size="sm"
                        className="rounded-full text-white/40 hover:text-destructive hover:bg-destructive/10 text-xs font-bold h-9"
                        disabled={isDemoMode}
                        onClick={() => handleUnlink(rarity)}>
                        <X className="w-3.5 h-3.5 mr-1" /> Unlink
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" size="sm"
                      className="rounded-full bg-white/5 border-white/10 hover:bg-white/10 text-white text-xs font-bold h-9"
                      disabled={isDemoMode}
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
            </motion.div>
          );
        })}

        {linkedCount === 0 && !isDemoMode && (
          <div className="text-center pt-8 pb-4 px-8">
            <div className="w-20 h-20 rounded-[1.75rem] glass-panel flex items-center justify-center mx-auto mb-5">
              <Music2 className="w-8 h-8 text-white/30" />
            </div>
            <p className="text-sm text-white/50 max-w-[300px] mx-auto leading-relaxed">
              Link an Apple Music playlist to each rarity, then use <span className="text-white font-bold">Refresh all</span> to keep your collection in sync automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
