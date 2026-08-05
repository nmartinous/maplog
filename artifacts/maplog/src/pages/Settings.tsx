import React, { useRef, useState } from 'react';
import { useMusicKit } from '@/context/MusicKitContext';
import type { MaplogSong } from '@/lib/types';
import { DEMO_RARITIES, rarityFromLabel } from '@/lib/rarityMap';
import {
  Trash2, Download, Upload, Sparkles, Shield, ExternalLink,
  Info, ChevronRight, FileText, CheckCircle2, XCircle, Loader2,
  ChevronDown, ChevronUp, Music2, Target
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

function findBestMatch(results: MaplogSong[], artist: string, title: string): MaplogSong {
  const a = artist.toLowerCase(), t = title.toLowerCase();
  return results.find(r => r.artist.toLowerCase() === a && r.title.toLowerCase() === t)
    ?? results.find(r => r.title.toLowerCase().includes(t))
    ?? results[0];
}

function parseLine(raw: string) {
  const parts = raw.trim().replace(/\s*–\s*/g, ' - ').split(' - ');
  if (parts.length < 3) return null;
  const artist = parts[0].trim(), title = parts[1].trim(), rarityRaw = parts.slice(2).join(' - ').trim();
  if (!artist || !title || !rarityRaw) return null;
  return { artist, title, rarityRaw };
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

// ── Shared import UI pieces ────────────────────────────────────────────────────

type ImportPhase =
  | { phase: 'idle' }
  | { phase: 'importing'; total: number; done: number; added: number; failed: string[] }
  | { phase: 'done'; total: number; added: number; failed: string[] };

function ImportProgress({ status }: { status: Extract<ImportPhase, { phase: 'importing' }> }) {
  return (
    <div className="py-3 space-y-4">
      <div className="flex items-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-bold text-white">Searching {status.done} of {status.total}…</p>
          <p className="text-xs text-white/50 mt-0.5">{status.added} added · {status.failed.length} not found</p>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(255,60,0,0.5)]"
          style={{ width: `${Math.round((status.done / status.total) * 100)}%` }} />
      </div>
    </div>
  );
}

function ImportDone({ status, onReset }: { status: Extract<ImportPhase, { phase: 'done' }>; onReset: () => void }) {
  return (
    <div className={cn('rounded-2xl p-4 text-sm space-y-2', status.added > 0 ? 'bg-green-500/10 border border-green-500/20' : 'bg-white/5 border border-white/10')}>
      <div className="flex items-center gap-2 font-bold text-white">
        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
        {status.added} of {status.total} songs added
      </div>
      {status.failed.slice(0, 5).map((f, i) => (
        <div key={i} className="flex items-start gap-1.5 text-xs text-white/50">
          <XCircle className="w-3.5 h-3.5 text-destructive/70 shrink-0 mt-0.5" /> {f}
        </div>
      ))}
      {status.failed.length > 5 && (
        <p className="text-xs text-white/50">…and {status.failed.length - 5} more not found</p>
      )}
      <Button variant="outline" size="sm" className="rounded-xl mt-1 bg-white/5 border-white/10 hover:bg-white/10 text-white" onClick={onReset}>
        Import another
      </Button>
    </div>
  );
}

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

function parseTrackLine(raw: string): { artist: string; title: string } | null {
  const line = raw.trim();
  if (!line) return null;
  const dash = line.replace(/\s*[—–]\s*/g, ' - ').split(' - ');
  if (dash.length >= 2) {
    const [artist, ...rest] = dash;
    const title = rest.join(' - ').trim();
    if (artist.trim() && title) return { artist: artist.trim(), title };
  }
  return null;
}

function AppleMusicImport({ searchDeezer, addToCollection }: { searchDeezer: (q: string) => Promise<MaplogSong[]>; addToCollection: (song: MaplogSong, rarity: any) => void; }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [raritySlug, setRaritySlug] = useState(DEMO_RARITIES[0].slug);
  const [status, setStatus] = useState<ImportPhase>({ phase: 'idle' });

  const selectedRarity = DEMO_RARITIES.find(r => r.slug === raritySlug) ?? DEMO_RARITIES[0];
  const isRunning = status.phase === 'importing';
  const parsedLines = text.split('\n').map(parseTrackLine).filter((x): x is { artist: string; title: string } => x !== null);

  const handleImport = async () => {
    if (!parsedLines.length) return;
    setStatus({ phase: 'importing', total: parsedLines.length, done: 0, added: 0, failed: [] });
    let added = 0; const failed: string[] = [];
    for (let i = 0; i < parsedLines.length; i++) {
      const { artist, title } = parsedLines[i];
      try {
        const results = await searchDeezer(`${artist} ${title}`);
        if (!results.length) { failed.push(`"${title}" — not found`); setStatus(p => p.phase === 'importing' ? { ...p, done: i + 1, failed } : p); continue; }
        addToCollection(findBestMatch(results, artist, title), selectedRarity);
        added++; setStatus(p => p.phase === 'importing' ? { ...p, done: i + 1, added } : p);
      } catch { failed.push(`"${title}" — search error`); setStatus(p => p.phase === 'importing' ? { ...p, done: i + 1, failed } : p); }
      if (i < parsedLines.length - 1) await new Promise(r => setTimeout(r, 350));
    }
    setStatus({ phase: 'done', total: parsedLines.length, added, failed });
  };

  return (
    <div className="glass-panel rounded-[2rem] overflow-hidden">
      <button className="w-full flex items-center gap-5 px-6 py-5 text-left hover:bg-white/5 active:bg-white/10 transition-colors group" onClick={() => setOpen(!open)} disabled={isRunning}>
        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
          <Music2 className="h-6 w-6 text-white/70 group-hover:text-primary transition-colors" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base text-white mb-1">Apple Music Import</p>
          <p className="text-sm text-white/50 mt-0.5">Paste playlist tracks</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
          {open ? <ChevronUp className="h-5 w-5 text-white/70" /> : <ChevronDown className="h-5 w-5 text-white/70" />}
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-white/5 overflow-hidden">
            <div className="px-6 py-6 space-y-6">
              {status.phase === 'importing' && <ImportProgress status={status} />}
              {status.phase === 'done' && <ImportDone status={status} onReset={() => { setStatus({ phase: 'idle' }); setText(''); }} />}
              {status.phase === 'idle' && (
                <>
                  <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-4 space-y-2">
                    <p className="text-xs font-bold text-white/70">How to get your track list</p>
                    <ul className="text-xs text-white/50 space-y-1 leading-relaxed">
                      <li><span className="text-white/70 font-semibold">Mac:</span> Open playlist → select all → copy → paste below</li>
                      <li><span className="text-white/70 font-semibold">iOS Shortcut:</span> "Get Playlist" → format as "Artist — Title" → share as text</li>
                    </ul>
                    <p className="text-xs text-white/50">Each line: <code className="bg-white/10 px-1.5 py-0.5 rounded font-mono">Artist — Title</code></p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-white/50 uppercase tracking-widest">
                      Paste tracks {parsedLines.length > 0 && <span className="text-primary normal-case">· {parsedLines.length} detected</span>}
                    </label>
                    <textarea
                      className="w-full h-32 rounded-2xl bg-white/5 border border-white/10 px-4 py-4 text-sm font-mono text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none leading-relaxed"
                      placeholder={"Taylor Swift — Shake It Off\nThe Weeknd — Blinding Lights"}
                      value={text} onChange={e => setText(e.target.value)} />
                  </div>
                  <RarityPicker raritySlug={raritySlug} setRaritySlug={setRaritySlug} />
                  <Button className="w-full rounded-xl font-bold h-12 text-base" onClick={handleImport} disabled={parsedLines.length === 0}>
                    {parsedLines.length > 0 ? `Import ${parsedLines.length} track${parsedLines.length !== 1 ? 's' : ''}` : 'Paste tracks above to import'}
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

// ── Batch text import ("Artist - Title - Rarity" lines) ───────────────────────

function BatchImport({ searchDeezer, addToCollection }: {
  searchDeezer: (q: string) => Promise<MaplogSong[]>;
  addToCollection: (song: MaplogSong, rarity: any) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<ImportPhase>({ phase: 'idle' });

  const isRunning = status.phase === 'importing';

  const handleImport = async () => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;
    setStatus({ phase: 'importing', total: lines.length, done: 0, added: 0, failed: [] });

    let added = 0; const failed: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const parsed = parseLine(lines[i]);
      if (!parsed) {
        failed.push(`Line ${i + 1}: bad format — use "Artist - Title - Rarity"`);
        setStatus(p => p.phase === 'importing' ? { ...p, done: i + 1, failed: [...failed] } : p);
        continue;
      }
      const rarity = rarityFromLabel(parsed.rarityRaw);
      if (!rarity) {
        failed.push(`Line ${i + 1}: unknown rarity "${parsed.rarityRaw}"`);
        setStatus(p => p.phase === 'importing' ? { ...p, done: i + 1, failed: [...failed] } : p);
        continue;
      }
      try {
        const results = await searchDeezer(`${parsed.artist} ${parsed.title}`);
        if (!results.length) {
          failed.push(`Line ${i + 1}: "${parsed.title}" not found`);
          setStatus(p => p.phase === 'importing' ? { ...p, done: i + 1, failed: [...failed] } : p);
          continue;
        }
        addToCollection(findBestMatch(results, parsed.artist, parsed.title), rarity);
        added++;
        setStatus(p => p.phase === 'importing' ? { ...p, done: i + 1, added } : p);
      } catch {
        failed.push(`Line ${i + 1}: search failed`);
        setStatus(p => p.phase === 'importing' ? { ...p, done: i + 1, failed: [...failed] } : p);
      }
      if (i < lines.length - 1) await new Promise(r => setTimeout(r, 350));
    }
    setStatus({ phase: 'done', total: lines.length, added, failed });
  };

  return (
    <div className="glass-panel rounded-[2rem] overflow-hidden">
      <button className="w-full flex items-center gap-5 px-6 py-5 text-left hover:bg-white/5 active:bg-white/10 transition-colors group" onClick={() => setOpen(!open)} disabled={isRunning}>
        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
          <FileText className="h-6 w-6 text-white/70 group-hover:text-primary transition-colors" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base text-white mb-1">List Import</p>
          <p className="text-sm text-white/50 mt-0.5">Paste "Artist - Title - Rarity" lines</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
          {open ? <ChevronUp className="h-5 w-5 text-white/70" /> : <ChevronDown className="h-5 w-5 text-white/70" />}
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-white/5 overflow-hidden">
            <div className="px-6 py-6 space-y-6">
              {status.phase === 'importing' && <ImportProgress status={status} />}
              {status.phase === 'done' && <ImportDone status={status} onReset={() => { setStatus({ phase: 'idle' }); setText(''); }} />}
              {status.phase === 'idle' && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-white/50 uppercase tracking-widest">One entry per line — Artist · Title · Rarity</label>
                    <textarea
                      className="w-full h-32 rounded-2xl bg-white/5 border border-white/10 px-4 py-4 text-sm font-mono text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none leading-relaxed"
                      placeholder={"Queen - Bohemian Rhapsody - Rare\nThe Beatles - Hey Jude - Uncommon\nDaft Punk - Get Lucky - Common"}
                      value={text} onChange={e => setText(e.target.value)} />
                  </div>
                  <p className="text-xs text-white/50">Valid rarities: <span className="font-mono text-white/70">Common · Uncommon · Rare</span></p>
                  <Button className="w-full rounded-xl font-bold h-12 text-base" onClick={handleImport} disabled={!text.trim()}>
                    Import songs
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
  const { songs, enterDemoMode, exitDemoMode, isDemoMode, addToCollection, searchDeezer, hasToken, isAuthorized, authorize } = useMusicKit();
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

        {!isDemoMode && (
          <section className="space-y-4">
            <h2 className="text-xs font-bold tracking-widest uppercase text-white/50 px-2 flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              Import
            </h2>
            <div className="space-y-4">
              <AppleMusicImport searchDeezer={searchDeezer} addToCollection={addToCollection} />
              <BatchImport searchDeezer={searchDeezer} addToCollection={addToCollection} />
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
