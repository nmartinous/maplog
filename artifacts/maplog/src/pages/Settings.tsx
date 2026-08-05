import React, { useRef, useState } from 'react';
import { useMusicKit } from '@/context/MusicKitContext';
import type { MaplogSong } from '@/lib/types';
import { DEMO_RARITIES, rarityFromLabel } from '@/lib/rarityMap';
import {
  Trash2, Download, Upload, Sparkles, Shield, ExternalLink,
  Info, ChevronRight, FileText, CheckCircle2, XCircle, Loader2,
  ChevronDown, ChevronUp, Music2, Link2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ── Helpers ────────────────────────────────────────────────────────────────────

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

// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[10px] font-black tracking-widest uppercase text-muted-foreground px-1">{title}</h2>
      <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
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
      className={cn('flex items-center gap-4 px-4 py-4', onClick && 'cursor-pointer hover:bg-accent/50 active:bg-accent/70 transition-colors')}
      onClick={onClick}
    >
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', destructive ? 'bg-destructive/10' : 'bg-muted')}>
        <Icon className={cn('h-4 w-4', destructive ? 'text-destructive' : 'text-muted-foreground')} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('font-semibold text-sm', destructive && 'text-destructive')}>{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>}
      </div>
      {children ?? (onClick && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />)}
    </div>
  );
}

// ── Apple Music Playlist Import ────────────────────────────────────────────────
/*
  Apple Music's web player is fully client-side rendered — there is no track data
  in the page HTML to scrape, and the catalog API requires a developer token (401).
  
  Practical bridge until the Apple developer enrollment clears:
  The user pastes "Artist — Title" lines (the format shown in Apple Music's track
  list on desktop/iOS) and picks one rarity for the whole batch. Deezer is searched
  per track to attach a 30s preview URL, matching the same flow as batch text import.

  How to copy from Apple Music:
  - Desktop: select all tracks → copy → paste here (gives "Title\nArtist" or similar)
  - iOS Shortcut: "Get Playlist Songs" → "Repeat with Each" → format as text → share
*/

type AMStatus =
  | { phase: 'idle' }
  | { phase: 'importing'; total: number; done: number; added: number; failed: string[] }
  | { phase: 'done'; total: number; added: number; failed: string[] };

/**
 * Parse a paste that may be:
 *   "Artist — Title"  (em-dash, Apple Music desktop copy)
 *   "Artist - Title"  (hyphen)
 *   "Title\nArtist"   (two-line format from some iOS Shortcuts)
 * Returns null if we can't determine artist+title.
 */
function parseTrackLine(raw: string): { artist: string; title: string } | null {
  const line = raw.trim();
  if (!line) return null;

  // "Artist — Title" or "Artist - Title"
  const dash = line.replace(/\s*[—–]\s*/g, ' - ').split(' - ');
  if (dash.length >= 2) {
    const [artist, ...rest] = dash;
    const title = rest.join(' - ').trim();
    if (artist.trim() && title) return { artist: artist.trim(), title };
  }
  return null;
}

function AppleMusicImport({ searchDeezer, addToCollection }: {
  searchDeezer: (q: string) => Promise<MaplogSong[]>;
  addToCollection: (song: MaplogSong, rarity: any) => void;
}) {
  const [open, setOpen]         = useState(false);
  const [text, setText]         = useState('');
  const [raritySlug, setRaritySlug] = useState(DEMO_RARITIES[0].slug);
  const [status, setStatus]     = useState<AMStatus>({ phase: 'idle' });

  const selectedRarity = DEMO_RARITIES.find(r => r.slug === raritySlug) ?? DEMO_RARITIES[0];
  const isRunning = status.phase === 'importing';

  const parsedLines = text
    .split('\n')
    .map(parseTrackLine)
    .filter((x): x is { artist: string; title: string } => x !== null);

  const handleImport = async () => {
    if (!parsedLines.length) return;
    setStatus({ phase: 'importing', total: parsedLines.length, done: 0, added: 0, failed: [] });

    let added = 0;
    const failed: string[] = [];

    for (let i = 0; i < parsedLines.length; i++) {
      const { artist, title } = parsedLines[i];
      try {
        const results = await searchDeezer(`${artist} ${title}`);
        if (!results.length) {
          const msg = `"${title}" — not found on Deezer`;
          failed.push(msg);
          setStatus(p => p.phase === 'importing' ? { ...p, done: i + 1, failed: [...p.failed, msg] } : p);
          continue;
        }
        addToCollection(findBestMatch(results, artist, title), selectedRarity);
        added++;
        setStatus(p => p.phase === 'importing' ? { ...p, done: i + 1, added } : p);
      } catch {
        const msg = `"${title}" — search error`;
        failed.push(msg);
        setStatus(p => p.phase === 'importing' ? { ...p, done: i + 1, failed: [...p.failed, msg] } : p);
      }
      if (i < parsedLines.length - 1) await new Promise(r => setTimeout(r, 350));
    }
    setStatus({ phase: 'done', total: parsedLines.length, added, failed });
  };

  const reset = () => { setStatus({ phase: 'idle' }); setText(''); };

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      <button
        className="w-full flex items-center gap-4 px-4 py-4 text-left hover:bg-accent/50 active:bg-accent/70 transition-colors"
        onClick={() => setOpen(o => !o)}
        disabled={isRunning}
      >
        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <Music2 className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Import from Apple Music playlist</p>
          <p className="text-xs text-muted-foreground mt-0.5">Paste track lines, pick a rarity — previews via Deezer</p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4 space-y-4">

          {/* Importing progress */}
          {status.phase === 'importing' && (
            <div className="py-3 space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">Searching {status.done} of {status.total}…</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {status.added} added · {status.failed.length} not found on Deezer
                  </p>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${Math.round((status.done / status.total) * 100)}%` }} />
              </div>
            </div>
          )}

          {/* Done summary */}
          {status.phase === 'done' && (
            <div className={cn('rounded-xl p-3 text-sm space-y-1.5', status.added > 0 ? 'bg-green-500/10 border border-green-500/20' : 'bg-muted/50')}>
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                {status.added} of {status.total} songs added
              </div>
              {status.failed.slice(0, 5).map((f, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <XCircle className="w-3.5 h-3.5 text-destructive/70 shrink-0 mt-0.5" /> {f}
                </div>
              ))}
              {status.failed.length > 5 && (
                <p className="text-xs text-muted-foreground">…and {status.failed.length - 5} more not found</p>
              )}
              <Button variant="outline" size="sm" className="rounded-lg mt-1" onClick={reset}>Import another</Button>
            </div>
          )}

          {/* Input form */}
          {status.phase === 'idle' && (
            <>
              {/* How-to hint */}
              <div className="rounded-xl bg-muted/40 border border-border/40 px-3 py-3 space-y-1.5">
                <p className="text-xs font-semibold text-foreground/80">How to get your track list</p>
                <ul className="text-xs text-muted-foreground space-y-1 leading-relaxed">
                  <li><span className="text-foreground/60 font-medium">Mac:</span> Open playlist → select all → copy → paste below</li>
                  <li><span className="text-foreground/60 font-medium">iOS Shortcut:</span> "Get Playlist" → format as "Artist — Title" → share as text</li>
                </ul>
                <p className="text-xs text-muted-foreground">Each line should be <code className="bg-muted px-1 rounded font-mono">Artist — Title</code> or <code className="bg-muted px-1 rounded font-mono">Artist - Title</code></p>
              </div>

              {/* Paste field */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Paste tracks {parsedLines.length > 0 && <span className="text-primary normal-case font-medium">· {parsedLines.length} detected</span>}
                </label>
                <textarea
                  className="w-full h-36 rounded-xl bg-muted/40 border border-border/60 px-3 py-3 text-sm font-mono text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none leading-relaxed"
                  placeholder={"Taylor Swift — Shake It Off\nThe Weeknd — Blinding Lights\nDua Lipa — Levitating"}
                  value={text}
                  onChange={e => setText(e.target.value)}
                />
              </div>

              {/* Rarity picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Assign rarity to all tracks
                </label>
                <div className="flex gap-2">
                  {DEMO_RARITIES.map(r => (
                    <button
                      key={r.slug}
                      onClick={() => setRaritySlug(r.slug)}
                      className={cn(
                        'flex-1 py-2 rounded-xl text-xs font-bold transition-all border',
                        raritySlug === r.slug
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/40 text-muted-foreground border-border/40 hover:bg-muted',
                      )}
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                className="w-full rounded-xl font-bold"
                onClick={handleImport}
                disabled={parsedLines.length === 0}
              >
                {parsedLines.length > 0
                  ? `Import ${parsedLines.length} song${parsedLines.length !== 1 ? 's' : ''} as ${selectedRarity.name}`
                  : 'Paste tracks above to import'}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Batch text Import ──────────────────────────────────────────────────────────

type ImportStatus =
  | { phase: 'idle' }
  | { phase: 'running'; total: number; done: number; added: number; failed: string[] }
  | { phase: 'done'; total: number; added: number; failed: string[] };

const EXAMPLE = `Queen - Bohemian Rhapsody - Rare
The Beatles - Hey Jude - Uncommon
Daft Punk - Get Lucky - Common`;

function BatchImport({ searchDeezer, addToCollection }: {
  searchDeezer: (q: string) => Promise<MaplogSong[]>;
  addToCollection: (song: MaplogSong, rarity: any) => void;
}) {
  const [open, setOpen]   = useState(false);
  const [text, setText]   = useState('');
  const [status, setStatus] = useState<ImportStatus>({ phase: 'idle' });

  const handleImport = async () => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;
    setStatus({ phase: 'running', total: lines.length, done: 0, added: 0, failed: [] });

    let added = 0; const failed: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const parsed = parseLine(lines[i]);
      if (!parsed) {
        const msg = `Line ${i + 1}: bad format — use "Artist - Title - Rarity"`;
        failed.push(msg);
        setStatus(p => p.phase === 'running' ? { ...p, done: i + 1, failed: [...p.failed, msg] } : p);
        continue;
      }
      const rarity = rarityFromLabel(parsed.rarityRaw);
      if (!rarity) {
        const msg = `Line ${i + 1}: unknown rarity "${parsed.rarityRaw}"`;
        failed.push(msg);
        setStatus(p => p.phase === 'running' ? { ...p, done: i + 1, failed: [...p.failed, msg] } : p);
        continue;
      }
      try {
        const results = await searchDeezer(`${parsed.artist} ${parsed.title}`);
        if (!results.length) {
          const msg = `Line ${i + 1}: "${parsed.title}" not found`;
          failed.push(msg); setStatus(p => p.phase === 'running' ? { ...p, done: i + 1, failed: [...p.failed, msg] } : p);
          continue;
        }
        addToCollection(findBestMatch(results, parsed.artist, parsed.title), rarity);
        added++;
        setStatus(p => p.phase === 'running' ? { ...p, done: i + 1, added } : p);
      } catch {
        const msg = `Line ${i + 1}: search failed`;
        failed.push(msg); setStatus(p => p.phase === 'running' ? { ...p, done: i + 1, failed: [...p.failed, msg] } : p);
      }
      if (i < lines.length - 1) await new Promise(r => setTimeout(r, 350));
    }
    setStatus({ phase: 'done', total: lines.length, added, failed });
  };

  const isRunning = status.phase === 'running';

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      <button
        className="w-full flex items-center gap-4 px-4 py-4 text-left hover:bg-accent/50 active:bg-accent/70 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <FileText className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Import from list</p>
          <p className="text-xs text-muted-foreground mt-0.5">Paste "Artist - Title - Rarity" lines</p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4 space-y-4">
          {isRunning ? (
            <div className="py-4 space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">Searching {status.done} of {status.total}…</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {status.added} added · {status.failed.length} failed
                  </p>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${Math.round((status.done / status.total) * 100)}%` }} />
              </div>
            </div>
          ) : (
            <>
              {status.phase === 'done' && (
                <div className={cn('rounded-xl p-3 text-sm space-y-1', status.added > 0 ? 'bg-green-500/10 border border-green-500/20' : 'bg-muted/50')}>
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    {status.added} of {status.total} songs added
                  </div>
                  {status.failed.map((f, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <XCircle className="w-3.5 h-3.5 text-destructive/70 shrink-0 mt-0.5" /> {f}
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  One entry per line — Artist · Title · Rarity
                </label>
                <textarea
                  className="w-full h-36 rounded-xl bg-muted/40 border border-border/60 px-3 py-3 text-sm font-mono text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none leading-relaxed"
                  placeholder={EXAMPLE} value={text}
                  onChange={e => setText(e.target.value)}
                />
              </div>
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer font-semibold hover:text-foreground transition-colors select-none">
                  Valid rarity names
                </summary>
                <p className="mt-2 font-mono leading-relaxed">Common · Uncommon · Rare</p>
              </details>
              <div className="flex gap-2">
                {status.phase === 'done' && (
                  <Button variant="outline" size="sm" className="rounded-lg"
                    onClick={() => { setStatus({ phase: 'idle' }); setText(''); }}>
                    Clear
                  </Button>
                )}
                <Button size="sm" className="flex-1 rounded-lg font-bold"
                  onClick={handleImport} disabled={!text.trim()}>
                  Import songs
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Settings page ─────────────────────────────────────────────────────────

export default function Settings() {
  const { songs, enterDemoMode, exitDemoMode, isDemoMode, addToCollection, searchDeezer } = useMusicKit();
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
    <div className="h-full overflow-y-auto">
      <div className="px-4 sm:px-6 pt-5 pb-8 space-y-8 max-w-2xl">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Settings</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Configure your Maplog experience</p>
        </div>

        {!isDemoMode && (
          <section className="space-y-3">
            <h2 className="text-[10px] font-black tracking-widest uppercase text-muted-foreground px-1">Import</h2>
            <AppleMusicImport searchDeezer={searchDeezer} addToCollection={addToCollection} />
            <BatchImport searchDeezer={searchDeezer} addToCollection={addToCollection} />
          </section>
        )}

        <Section title="Collection">
          <Row icon={Download} label="Export collection"
            description={`Download your ${songs.length} song${songs.length !== 1 ? 's' : ''} as JSON`}
            onClick={handleExport} />
          <Row icon={Upload} label="Import from backup"
            description="Restore from a previous JSON export" onClick={() => importRef.current?.click()} />
          <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImportFile} />
          {songs.length > 0 && (
            <Row icon={Trash2} label="Clear collection"
              description="Remove all songs and cards — irreversible" onClick={handleClear} destructive />
          )}
        </Section>

        <Section title="Demo Mode">
          <Row icon={Sparkles}
            label={isDemoMode ? 'Exit demo mode' : 'Enter demo mode'}
            description={isDemoMode ? 'Switch back to your real collection' : 'Browse 10 sample cards — no search needed'}
            onClick={isDemoMode ? exitDemoMode : enterDemoMode} />
        </Section>

        <Section title="Audio">
          <Row icon={Info} label="30-second previews via Deezer"
            description="Maplog uses Deezer's public API for search and previews — no account required." />
        </Section>

        <Section title="About">
          <Row icon={Shield} label="Maplog" description="Your personal Soundmap preservation archive">
            <span className="text-xs font-mono text-muted-foreground shrink-0">v1.0.0</span>
          </Row>
          <Row icon={ExternalLink} label="Soundmap" description="The original card game"
            onClick={() => window.open('https://soundmap.app', '_blank')} />
        </Section>
      </div>
    </div>
  );
}
