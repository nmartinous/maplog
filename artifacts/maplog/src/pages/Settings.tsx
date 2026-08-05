import React, { useRef, useState } from 'react';
import { useMusicKit } from '@/context/MusicKitContext';
import type { MaplogSong } from '@/lib/types';
import { DEMO_RARITIES } from '@/lib/rarityMap';
import {
  Trash2, Download, Upload, Sparkles, Shield, ExternalLink,
  Info, ChevronRight, CheckCircle2, XCircle, Loader2,
  ChevronDown, ChevronUp, Music2, Target
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RarityPlaylistSync } from '@/components/RarityPlaylistSync';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

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
      <div className="flex gap-2">
        {DEMO_RARITIES.map(r => (
          <button key={r.slug} onClick={() => setRaritySlug(r.slug)}
            className={cn('flex-1 py-3 rounded-xl text-sm font-bold transition-all border',
              raritySlug === r.slug
                ? 'bg-primary border-primary text-white shadow-[0_0_20px_rgba(255,60,0,0.3)]'
                : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10')}>
            {r.name}
          </button>
        ))}
      </div>
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
  const [raritySlug, setRaritySlug] = useState(DEMO_RARITIES[0].slug);
  const [status, setStatus] = useState<PlaylistPhase>({ phase: 'idle' });
  const [error, setError] = useState<string | null>(null);

  const selectedRarity = DEMO_RARITIES.find(r => r.slug === raritySlug) ?? DEMO_RARITIES[0];

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
  const { songs, enterDemoMode, exitDemoMode, isDemoMode, addToCollection, hasToken, isAuthorized, authorize } = useMusicKit();
  const importRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(songs, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `maplog-${new Date().toISOString().slice(0, 10)}.json`,
    });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string) as MaplogSong[];
        if (!Array.isArray(data)) throw new Error();
        let n = 0;
        for (const song of data) for (const card of song.cards ?? []) { addToCollection(song, card.rarityType); n++; }
        alert(`Imported ${n} card${n !== 1 ? 's' : ''} successfully.`);
      } catch { alert("Could not read the file. Make sure it's a valid Maplog export."); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleClear = () => {
    if (!confirm(`Delete all ${songs.length} songs? This cannot be undone.`)) return;
    localStorage.removeItem('maplog:collection');
    window.location.reload();
  };

  return (
    <div className="h-full overflow-y-auto bg-background pb-24">
      <div className="px-4 sm:px-6 pt-8 pb-8 space-y-10 max-w-2xl mx-auto">
        <div className="relative z-10">
          <h1 className="text-3xl font-display font-black tracking-tight text-white mb-2">Settings</h1>
          <p className="text-base text-white/50">Configure your Maplog experience</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-xs font-bold tracking-widest uppercase text-white/50 px-2 flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            Rarity Playlists
          </h2>
          <RarityPlaylistSync />
        </section>

        {!isDemoMode && (
          <section className="space-y-4">
            <h2 className="text-xs font-bold tracking-widest uppercase text-white/50 px-2 flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              Import
            </h2>
            <div className="space-y-4">
              <PlaylistImport addToCollection={addToCollection} collection={songs} />
            </div>
          </section>
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
          <Row icon={Download} label="Export Collection"
            description={`Backup your ${songs.length} song${songs.length !== 1 ? 's' : ''} to a JSON file`}
            onClick={handleExport} />
          <Row icon={Upload} label="Restore Backup"
            description="Import a previously exported JSON file" onClick={() => importRef.current?.click()} />
          <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImportFile} />
          {songs.length > 0 && (
            <Row icon={Trash2} label="Reset Collection"
              description="Permanently delete all songs and cards" onClick={handleClear} destructive />
          )}
        </Section>

        <Section title="Experience">
          <Row icon={Sparkles}
            label={isDemoMode ? 'Exit Demo Mode' : 'Enter Demo Mode'}
            description={isDemoMode ? 'Return to your actual saved collection' : 'Explore the app with premium sample data'}
            onClick={isDemoMode ? exitDemoMode : enterDemoMode} />
          <Row icon={Info} label="Playback"
            description="Songs stream in full from Apple Music when connected; otherwise 30-second previews play." />
        </Section>

        <Section title="About Maplog">
          <Row icon={Shield} label="Version" description="Your Soundmap archive">
            <span className="px-3 py-1.5 bg-primary/20 text-primary rounded-full text-xs font-bold tracking-widest">v1.0.0</span>
          </Row>
          <Row icon={ExternalLink} label="Original Game" description="Visit Soundmap.app"
            onClick={() => window.open('https://soundmap.app', '_blank')} />
        </Section>
      </div>
    </div>
  );
}
