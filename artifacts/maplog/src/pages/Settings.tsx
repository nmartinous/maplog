import React, { useEffect, useRef, useState } from 'react';
import { useMusicKit } from '@/context/MusicKitContext';
import type { MaplogSong } from '@/lib/types';
import { ALL_RARITIES } from '@/lib/rarityMap';
import {
  Trash2, Download, Upload, Shield, ExternalLink,
  Info, ChevronRight, CheckCircle2, XCircle, Loader2,
  ChevronDown, ChevronUp, Music2, Target, AlertTriangle, Pencil,
  Share2, CloudUpload,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { RarityPlaylistSync } from '@/components/RarityPlaylistSync';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  createBackupZip, parseBackupFile, restoreBackup, backupFileName, estimateBackupBytes,
  BACKUP_SIZE_WARN_BYTES, formatBytes, type ParsedBackup,
} from '@/lib/backup';

/**
 * Warn BEFORE building when the backup will be very large (estimated from
 * media sizes), so the user is informed ahead of the expensive operation.
 */
async function warnIfHugeBackup() {
  try {
    const estimated = await estimateBackupBytes();
    if (estimated > BACKUP_SIZE_WARN_BYTES) {
      toast.warning(
        `This backup will be about ${formatBytes(estimated)}. Very large backups can be slow to save or share on iPhone.`
      );
    }
  } catch {
    // Estimation is best-effort; never block the export on it.
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xs font-bold tracking-widest uppercase text-white/50 px-2 flex items-center gap-2">
        <Target className="w-4 h-4 text-primary" />
        {title}
      </h2>
      <div className="glass-panel rounded-[2rem] overflow-hidden divide-y divide-white/5">
        {children}
      </div>
    </section>
  );
}

function Row({ icon: Icon, label, description, onClick, children, destructive }: {
  icon: React.ElementType; label: string; description?: string;
  onClick?: () => void; children?: React.ReactNode; destructive?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-5 px-6 py-5 group',
        onClick && 'cursor-pointer hover:bg-white/5 active:bg-white/10 transition-colors'
      )}
      onClick={onClick}
    >
      <div className={cn(
        'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors',
        destructive 
          ? 'bg-destructive/10 text-destructive group-hover:bg-destructive group-hover:text-white' 
          : 'bg-white/5 text-white/70 group-hover:bg-primary/20 group-hover:text-primary'
      )}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('font-bold text-base mb-1', destructive ? 'text-destructive' : 'text-white')}>{label}</p>
        {description && <p className="text-sm text-white/50 leading-relaxed pr-4">{description}</p>}
      </div>
      {children ?? (onClick && (
        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 group-hover:-translate-x-1 transition-all">
          <ChevronRight className="h-5 w-5 text-white/70" />
        </div>
      ))}
    </div>
  );
}

// ── Rarity picker ──────────────────────────────────────────────────────────────

function RarityPicker({ raritySlug, setRaritySlug }: { raritySlug: string; setRaritySlug: (s: string) => void }) {
  return (
    <div className="space-y-3">
      <label className="text-xs font-bold text-white/50 uppercase tracking-widest">Assign rarity to all tracks</label>
      <select
        value={raritySlug}
        onChange={e => setRaritySlug(e.target.value)}
        className="w-full h-12 rounded-2xl bg-white/5 border border-white/10 px-4 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none"
      >
        {ALL_RARITIES.map(r => (
          <option key={r.slug} value={r.slug} className="bg-[#141417] text-white">{r.name}</option>
        ))}
      </select>
    </div>
  );
}

// ── Playlist import (Apple Music playlist URL → full track list) ──────────────

type PlaylistPhase =
  | { phase: 'idle' }
  | { phase: 'fetching' }
  | { phase: 'loaded'; name: string; songs: MaplogSong[] }
  | { phase: 'done'; name: string; added: number; skipped: number };

function PlaylistImport({ addToCollection, collection }: {
  addToCollection: (song: MaplogSong, rarity: any) => void;
  collection: MaplogSong[];
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [raritySlug, setRaritySlug] = useState(ALL_RARITIES[0].slug);
  const [status, setStatus] = useState<PlaylistPhase>({ phase: 'idle' });
  const [error, setError] = useState<string | null>(null);

  const selectedRarity = ALL_RARITIES.find(r => r.slug === raritySlug) ?? ALL_RARITIES[0];

  const handleFetch = async () => {
    setError(null);
    setStatus({ phase: 'fetching' });
    try {
      const res = await fetch(`/api/apple-music/playlist?url=${encodeURIComponent(url.trim())}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? 'Could not load the playlist.');
      const songs: MaplogSong[] = (data.songs ?? []).map((t: any): MaplogSong => ({
        id: `apple:${t.id}`,
        source: 'apple',
        title: t.title,
        artist: t.artist,
        album: t.album,
        genre: t.genre ?? null,
        durationMs: t.durationMs ?? 0,
        artworkUrl: t.artworkUrl ?? '',
        previewUrl: t.previewUrl ?? null,
        cards: [],
      }));
      setStatus({ phase: 'loaded', name: data.name, songs });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the playlist.');
      setStatus({ phase: 'idle' });
    }
  };

  const handleImport = () => {
    if (status.phase !== 'loaded') return;
    // Skip songs that already have a card of the chosen rarity — seed from
    // the current collection, then track additions made during this run so
    // duplicate tracks within the playlist can't double-add.
    const ownedAtRarity = new Set(
      collection
        .filter(s => s.cards.some(c => c.rarityType.slug === selectedRarity.slug))
        .map(s => s.id),
    );
    let added = 0, skipped = 0;
    for (const song of status.songs) {
      if (ownedAtRarity.has(song.id)) { skipped++; continue; }
      addToCollection(song, selectedRarity);
      ownedAtRarity.add(song.id);
      added++;
    }
    setStatus({ phase: 'done', name: status.name, added, skipped });
  };

  const reset = () => { setStatus({ phase: 'idle' }); setUrl(''); setError(null); };

  return (
    <div className="glass-panel rounded-[2rem] overflow-hidden">
      <button className="w-full flex items-center gap-5 px-6 py-5 text-left hover:bg-white/5 active:bg-white/10 transition-colors group" onClick={() => setOpen(!open)}>
        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
          <Music2 className="h-6 w-6 text-white/70 group-hover:text-primary transition-colors" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base text-white mb-1">Playlist Import</p>
          <p className="text-sm text-white/50 mt-0.5">Paste an Apple Music playlist link</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
          {open ? <ChevronUp className="h-5 w-5 text-white/70" /> : <ChevronDown className="h-5 w-5 text-white/70" />}
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-white/5 overflow-hidden">
            <div className="px-6 py-6 space-y-6">
              {status.phase === 'done' ? (
                <div className={cn('rounded-2xl p-4 text-sm space-y-2', status.added > 0 ? 'bg-green-500/10 border border-green-500/20' : 'bg-white/5 border border-white/10')}>
                  <div className="flex items-center gap-2 font-bold text-white">
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                    {status.added} song{status.added !== 1 ? 's' : ''} added from "{status.name}"
                  </div>
                  {status.skipped > 0 && (
                    <p className="text-xs text-white/50">{status.skipped} already in your binder with this rarity — skipped.</p>
                  )}
                  <Button variant="outline" size="sm" className="rounded-xl mt-1 bg-white/5 border-white/10 hover:bg-white/10 text-white" onClick={reset}>
                    Import another
                  </Button>
                </div>
              ) : status.phase === 'loaded' ? (
                <>
                  <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-4">
                    <p className="text-sm font-bold text-white">{status.name}</p>
                    <p className="text-xs text-white/50 mt-1">{status.songs.length} track{status.songs.length !== 1 ? 's' : ''} found</p>
                  </div>
                  <RarityPicker raritySlug={raritySlug} setRaritySlug={setRaritySlug} />
                  <div className="flex gap-3">
                    <Button variant="outline" className="rounded-xl h-12 bg-white/5 border-white/10 hover:bg-white/10 text-white" onClick={reset}>
                      Cancel
                    </Button>
                    <Button className="flex-1 rounded-xl font-bold h-12 text-base" onClick={handleImport}>
                      Add {status.songs.length} track{status.songs.length !== 1 ? 's' : ''} as {selectedRarity.name}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-4 space-y-2">
                    <p className="text-xs font-bold text-white/70">How it works</p>
                    <ul className="text-xs text-white/50 space-y-1 leading-relaxed">
                      <li>In Apple Music: open the playlist → Share → Copy Link</li>
                      <li>Paste the link below — every track imports automatically</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-white/50 uppercase tracking-widest">Playlist link</label>
                    <input
                      type="url"
                      inputMode="url"
                      className="w-full h-12 rounded-2xl bg-white/5 border border-white/10 px-4 text-sm font-mono text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="https://music.apple.com/us/playlist/…"
                      value={url} onChange={e => setUrl(e.target.value)} />
                  </div>
                  {error && (
                    <div className="flex items-start gap-2 text-xs text-destructive">
                      <XCircle className="w-4 h-4 shrink-0" /> {error}
                    </div>
                  )}
                  <Button className="w-full rounded-xl font-bold h-12 text-base" onClick={handleFetch}
                    disabled={!url.trim().includes('music.apple.com') || status.phase === 'fetching'}>
                    {status.phase === 'fetching'
                      ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading playlist…</span>
                      : 'Load playlist'}
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Settings() {
  const [rarityOpen, setRarityOpen] = useState<boolean>(() => localStorage.getItem('maplog:rarityOpen') !== '0');
  useEffect(() => { localStorage.setItem('maplog:rarityOpen', rarityOpen ? '1' : '0'); }, [rarityOpen]);
  const { songs, addToCollection, hasToken, isAuthorized, authorize, conflicts } = useMusicKit();
  const [, navigate] = useLocation();
  const importRef = useRef<HTMLInputElement>(null);

  // ── Backup export/import ──────────────────────────────────────────────────
  type ExportState = 'idle' | 'building' | 'sharing' | 'uploading';
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [pending, setPending] = useState<ParsedBackup | null>(null);
  const [restoring, setRestoring] = useState(false);

  // Drive connection status — fetched once on mount
  type DriveStatus =
    | { state: 'loading' }
    | { state: 'connected'; email: string | null; csrfToken: string }
    | { state: 'unavailable'; reason: string };
  const [driveStatus, setDriveStatus] = useState<DriveStatus>({ state: 'loading' });

  useEffect(() => {
    fetch('/api/drive/status')
      .then(r => r.json())
      .then((d: any) => {
        if (d.connected) {
          setDriveStatus({ state: 'connected', email: d.email ?? null, csrfToken: d.csrfToken });
        } else {
          setDriveStatus({ state: 'unavailable', reason: d.reason ?? 'Google Drive is not configured.' });
        }
      })
      .catch(() => setDriveStatus({ state: 'unavailable', reason: 'Could not reach the server.' }));
  }, []);

  const exporting = exportState !== 'idle';

  /** Download the backup as a file (anchor-click). */
  const handleExport = async () => {
    if (exporting) return;
    setExportState('building');
    try {
      await warnIfHugeBackup();
      const blob = await createBackupZip();
      const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob),
        download: backupFileName(),
      });
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('Backup downloaded — keep it somewhere safe.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create the backup.");
    } finally {
      setExportState('idle');
    }
  };

  /** Share backup via the native OS share sheet (iOS, Android, desktop Chrome). */
  const handleShare = async () => {
    if (exporting) return;
    setExportState('building');
    try {
      await warnIfHugeBackup();
      const blob = await createBackupZip();
      const filename = backupFileName();
      const file = new File([blob], filename, { type: 'application/zip' });

      if (navigator.canShare?.({ files: [file] })) {
        setExportState('sharing');
        await navigator.share({
          files: [file],
          title: 'Maplog Backup',
          text: `Maplog backup — ${filename}`,
        });
        toast.success('Backup shared successfully.');
      } else {
        // Fallback: trigger a download
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), { href: url, download: filename });
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Backup downloaded (share not supported on this browser).');
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        toast.error(err instanceof Error ? err.message : "Couldn't share the backup.");
      }
    } finally {
      setExportState('idle');
    }
  };

  /** Upload backup directly to the user's Google Drive using a CSRF-protected endpoint. */
  const handleDriveUpload = async () => {
    if (exporting) return;
    if (driveStatus.state !== 'connected') {
      toast.error('Google Drive is not connected. Check your Replit workspace settings.');
      return;
    }
    setExportState('building');
    try {
      await warnIfHugeBackup();
      const blob = await createBackupZip();
      const filename = backupFileName();
      setExportState('uploading');
      const form = new FormData();
      form.append('backup', new File([blob], filename, { type: 'application/zip' }));
      form.append('filename', filename);
      const res = await fetch('/api/drive/upload', {
        method: 'POST',
        body: form,
        headers: { 'X-Drive-Token': driveStatus.csrfToken },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Upload failed (${res.status})`);
      // Refresh the token for the next upload (it rotates every 5 min)
      setDriveStatus(prev => prev.state === 'connected' ? { ...prev, csrfToken: data.csrfToken ?? prev.csrfToken } : prev);
      if (data.webViewLink) {
        toast.success(
          <span>Saved to Google Drive! <a href={data.webViewLink} target="_blank" rel="noopener noreferrer" className="underline font-bold">Open file ↗</a></span>
        );
      } else {
        toast.success('Backup saved to Google Drive.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't upload to Google Drive.");
    } finally {
      setExportState('idle');
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setPending(await parseBackupFile(file));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't read that file.");
    }
  };

  const handleRestore = async () => {
    if (!pending || restoring) return;
    setRestoring(true);
    try {
      await restoreBackup(pending);
      window.location.reload();
    } catch (err) {
      setRestoring(false);
      toast.error(err instanceof Error ? err.message : "Restore failed — your current data is unchanged.");
    }
  };

  const handleClear = () => {
    if (!confirm(`Delete all ${songs.length} songs? This cannot be undone.`)) return;
    localStorage.removeItem('maplog:collection');
    window.location.reload();
  };

  return (
    <div className="h-full overflow-y-auto bg-background pb-24">
      <div className="page-top px-4 sm:px-6 pb-8 space-y-10 max-w-2xl mx-auto">
        <div className="relative z-10">
          <h1 className="text-3xl font-display font-black tracking-tight text-white mb-2">Settings</h1>
          <p className="text-base text-white/50">Configure your Maplog experience</p>
        </div>

        <section className="space-y-4">
          <button
            onClick={() => setRarityOpen(o => !o)}
            aria-expanded={rarityOpen}
            className="w-full text-xs font-bold tracking-widest uppercase text-white/50 px-2 flex items-center gap-2 hover:text-white/80 transition-colors"
          >
            <Target className="w-4 h-4 text-primary" />
            Rarity Playlists
            <ChevronDown className={cn('w-4 h-4 ml-auto transition-transform duration-300', rarityOpen ? '' : '-rotate-90')} />
          </button>
          <AnimatePresence initial={false}>
            {rarityOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                className="overflow-hidden"
              >
                <RarityPlaylistSync />
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-bold tracking-widest uppercase text-white/50 px-2 flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            Import
          </h2>
          <div className="space-y-4">
            <PlaylistImport addToCollection={addToCollection} collection={songs} />
          </div>
        </section>

        <Section title="Edit Mode">
          <Row icon={Pencil} label="Open Edit Mode"
            description="Card media uploads, override rarities, tags, badges & conflicts"
            onClick={() => navigate('/edit')} />
        </Section>

        {conflicts.length > 0 && (
          <Section title="Conflicts">
            <Row icon={AlertTriangle} label="Resolve Conflicts"
              description={`${conflicts.length} conflict${conflicts.length !== 1 ? 's' : ''} from your last playlist refresh need${conflicts.length === 1 ? 's' : ''} a decision`}
              onClick={() => navigate('/conflicts')} />
          </Section>
        )}

        <Section title="Apple Music">
          {isAuthorized ? (
            <Row icon={Music2} label="Connected"
              description="Full-song playback is active via your Apple Music subscription.">
              <CheckCircle2 className="w-5 h-5 text-primary" />
            </Row>
          ) : (
            <Row icon={Music2} label="Connect Apple Music"
              description={hasToken
                ? 'Sign in with your Apple Music subscription to unlock full-song playback.'
                : 'Apple Music is unavailable right now — previews still work.'}
              onClick={hasToken ? authorize : undefined}>
              {hasToken && <ChevronRight className="w-5 h-5 text-white/30" />}
            </Row>
          )}
        </Section>

        <Section title="Data & Backup">
          <div className="px-6 pt-5 pb-1">
            <p className="text-xs text-white/40 leading-relaxed">
              Your songs come back anytime from your linked Apple Music playlists. Everything else —
              tags, override rarities, uploaded card media, badges, showcases, artist notes, and your
              profile — lives only on this device, so back it up here.
            </p>
          </div>
          {/* ── Download ── */}
          <Row
            icon={exportState === 'building' ? Loader2 : Download}
            label={exportState === 'building' ? 'Building backup…' : 'Download Backup'}
            description="Save a complete backup file to your device"
            onClick={exportState === 'idle' ? handleExport : undefined}
          >
            {exportState === 'building' && <Loader2 className="w-5 h-5 text-white/40 animate-spin" />}
          </Row>
          {/* ── Share Sheet (iOS / Web Share API) ── */}
          <Row
            icon={exportState === 'sharing' ? Loader2 : Share2}
            label={exportState === 'sharing' ? 'Waiting for share…' : 'Share Backup'}
            description="Open the share sheet — save to Files, AirDrop, Google Drive app, and more"
            onClick={exportState === 'idle' ? handleShare : undefined}
          >
            {exportState === 'sharing' && <Loader2 className="w-5 h-5 text-white/40 animate-spin" />}
          </Row>
          {/* ── Google Drive direct upload ── */}
          {driveStatus.state === 'unavailable' ? (
            <Row
              icon={CloudUpload}
              label="Save to Google Drive"
              description={driveStatus.reason}
            >
              <XCircle className="w-5 h-5 text-white/20" />
            </Row>
          ) : (
            <Row
              icon={exportState === 'uploading' ? Loader2 : CloudUpload}
              label={exportState === 'uploading' ? 'Uploading to Drive…' : 'Save to Google Drive'}
              description={
                driveStatus.state === 'loading'
                  ? 'Checking Drive connection…'
                  : driveStatus.email
                    ? `Uploads to ${driveStatus.email}`
                    : 'Upload directly to your Google Drive'
              }
              onClick={exportState === 'idle' && driveStatus.state === 'connected' ? handleDriveUpload : undefined}
            >
              {exportState === 'uploading'
                ? <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
                : driveStatus.state === 'loading'
                  ? <Loader2 className="w-5 h-5 text-white/20 animate-spin" />
                  : driveStatus.state === 'connected'
                    ? <CheckCircle2 className="w-5 h-5 text-primary" />
                    : null}
            </Row>
          )}
          {/* ── Import ── */}
          <Row icon={Upload} label="Import Content"
            description="Restore a Maplog backup file (older JSON exports work too)"
            onClick={() => importRef.current?.click()} />
          <input ref={importRef} type="file" accept=".zip,.json,application/zip,application/json" className="hidden" onChange={handleImportFile} />
          {songs.length > 0 && (
            <Row icon={Trash2} label="Reset Collection"
              description="Permanently delete all songs and cards" onClick={handleClear} destructive />
          )}
        </Section>

        {/* ── Restore confirmation ── */}
        <AnimatePresence>
          {pending && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
              onClick={() => !restoring && setPending(null)}
            >
              <motion.div
                initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
                transition={{ type: 'spring', damping: 26, stiffness: 300 }}
                className="glass-panel rounded-[2rem] p-6 w-full max-w-md bg-[#141417]"
                onClick={e => e.stopPropagation()}
              >
                <h3 className="text-lg font-display font-black text-white mb-1">Restore this backup?</h3>
                <p className="text-xs text-white/40 mb-4">
                  {pending.summary.legacy
                    ? 'Older JSON export — restores the collection only; other content on this device is kept.'
                    : `Full backup${pending.summary.createdAt ? ` from ${new Date(pending.summary.createdAt).toLocaleDateString()}` : ''} — replaces all Maplog content on this device.`}
                </p>
                <div className="rounded-2xl bg-white/5 border border-white/10 divide-y divide-white/5 mb-5">
                  {[
                    ['Songs', pending.summary.songs],
                    ['Cards', pending.summary.cards],
                    ['Uploaded media files', pending.summary.mediaFiles],
                  ].map(([label, n]) => (
                    <div key={label} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-white/50">{label}</span>
                      <span className="text-sm font-display font-black text-white">{n}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="rounded-xl h-12 flex-1 bg-white/5 border-white/10 hover:bg-white/10 text-white"
                    disabled={restoring} onClick={() => setPending(null)}>
                    Cancel
                  </Button>
                  <Button className="rounded-xl h-12 flex-1 font-bold" onClick={handleRestore} disabled={restoring} data-testid="confirm-restore">
                    {restoring
                      ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Restoring…</span>
                      : 'Restore'}
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <Section title="Experience">
          <Row icon={Info} label="Playback"
            description="Songs stream in full from Apple Music when connected; otherwise 30-second previews play." />
        </Section>

        <Section title="About Maplog">
          <Row icon={Shield} label="Version" description="Your Soundmap archive">
            <span className="px-3 py-1.5 bg-primary/20 text-primary rounded-full text-xs font-bold tracking-widest">v1.2.0</span>
          </Row>
          <Row icon={ExternalLink} label="Original Game" description="Visit Soundmap.app"
            onClick={() => window.open('https://soundmap.app', '_blank')} />
        </Section>
      </div>
    </div>
  );
}
