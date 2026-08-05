import React, { useRef, useState } from 'react';
import { useMusicKit } from '@/context/MusicKitContext';
import type { MaplogSong } from '@/lib/types';
import { rarityFromLabel } from '@/lib/rarityMap';
import {
  Trash2, Download, Upload, Sparkles, Shield, ExternalLink,
  Info, ChevronRight, FileText, CheckCircle2, XCircle, Loader2,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ── Helpers ────────────────────────────────────────────────────────────────────

function findBestMatch(results: MaplogSong[], artist: string, title: string): MaplogSong {
  const a = artist.toLowerCase();
  const t = title.toLowerCase();
  // Prefer exact artist + title
  const exact = results.find(r => r.artist.toLowerCase() === a && r.title.toLowerCase() === t);
  if (exact) return exact;
  // Then title only
  const titleMatch = results.find(r => r.title.toLowerCase().includes(t));
  if (titleMatch) return titleMatch;
  return results[0];
}

function parseLine(raw: string): { artist: string; title: string; rarityRaw: string } | null {
  // Accept " - " or " – " as delimiter
  const parts = raw.trim().replace(/\s*–\s*/g, ' - ').split(' - ');
  if (parts.length < 3) return null;
  const artist    = parts[0].trim();
  const title     = parts[1].trim();
  const rarityRaw = parts.slice(2).join(' - ').trim();
  if (!artist || !title || !rarityRaw) return null;
  return { artist, title, rarityRaw };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-bold tracking-widest uppercase text-muted-foreground px-1">{title}</h2>
      <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
        {children}
      </div>
    </section>
  );
}

function Row({ icon: Icon, label, description, onClick, children, destructive }: {
  icon: React.ElementType;
  label: string;
  description?: string;
  onClick?: () => void;
  children?: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 px-4 py-4',
        onClick && 'cursor-pointer hover:bg-accent/50 transition-colors',
      )}
      onClick={onClick}
    >
      <div className={cn(
        'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
        destructive ? 'bg-destructive/10' : 'bg-muted',
      )}>
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

// ── Batch Import ───────────────────────────────────────────────────────────────

type ImportStatus =
  | { phase: 'idle' }
  | { phase: 'running'; total: number; done: number; added: number; failed: string[] }
  | { phase: 'done';    total: number; added: number; failed: string[] };

const EXAMPLE = `Queen - Bohemian Rhapsody - Rare
The Beatles - Hey Jude - Shiny Rare
Radiohead - Creep - Epic
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
    if (lines.length === 0) return;

    setStatus({ phase: 'running', total: lines.length, done: 0, added: 0, failed: [] });

    let added = 0;
    const failed: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const parsed = parseLine(lines[i]);
      if (!parsed) {
        failed.push(`Line ${i + 1}: bad format — use "Artist - Title - Rarity"`);
        setStatus(p => p.phase === 'running' ? { ...p, done: i + 1, failed: [...p.failed, failed[failed.length - 1]] } : p);
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
        if (results.length === 0) {
          const msg = `Line ${i + 1}: "${parsed.title}" not found on Deezer`;
          failed.push(msg);
          setStatus(p => p.phase === 'running' ? { ...p, done: i + 1, failed: [...p.failed, msg] } : p);
          continue;
        }
        const best = findBestMatch(results, parsed.artist, parsed.title);
        addToCollection(best, rarity);
        added++;
        setStatus(p => p.phase === 'running' ? { ...p, done: i + 1, added } : p);
      } catch {
        const msg = `Line ${i + 1}: search failed`;
        failed.push(msg);
        setStatus(p => p.phase === 'running' ? { ...p, done: i + 1, failed: [...p.failed, msg] } : p);
      }

      // Throttle: avoid hitting the proxy too fast
      if (i < lines.length - 1) await new Promise(r => setTimeout(r, 350));
    }

    setStatus({ phase: 'done', total: lines.length, added, failed });
  };

  const reset = () => {
    setStatus({ phase: 'idle' });
    setText('');
  };

  const isRunning = status.phase === 'running';

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      {/* Header row — toggles the panel */}
      <button
        className="w-full flex items-center gap-4 px-4 py-4 text-left hover:bg-accent/50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <FileText className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Import from list</p>
          <p className="text-xs text-muted-foreground mt-0.5">Paste "Artist - Title - Rarity" lines to bulk-add songs</p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4 space-y-4">
          {status.phase === 'idle' || status.phase === 'done' ? (
            <>
              {status.phase === 'done' && (
                <div className={cn(
                  'rounded-xl p-3 text-sm space-y-1',
                  status.added > 0 ? 'bg-green-500/10 border border-green-500/20' : 'bg-muted/50',
                )}>
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    {status.added} of {status.total} songs added
                  </div>
                  {status.failed.length > 0 && (
                    <div className="space-y-0.5 pt-1">
                      {status.failed.map((f, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <XCircle className="w-3.5 h-3.5 text-destructive/70 shrink-0 mt-0.5" />
                          {f}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  One entry per line — Artist · Title · Rarity
                </label>
                <textarea
                  className="w-full h-40 rounded-xl bg-muted/40 border border-border/60 px-3 py-3 text-sm font-mono text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none leading-relaxed"
                  placeholder={EXAMPLE}
                  value={text}
                  onChange={e => setText(e.target.value)}
                />
              </div>

              {/* Rarity reference */}
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer font-semibold text-muted-foreground/70 hover:text-muted-foreground transition-colors select-none">
                  Valid rarity names
                </summary>
                <div className="mt-2 font-mono leading-relaxed grid grid-cols-2 gap-x-4">
                  {['Common','Uncommon','Rare','Shiny Common','Shiny Uncommon','Shiny Rare',
                    'Epic','Special Edition','Special Epic','Streak Epic','Moment','Lyric','Radiant',
                  ].map(r => <span key={r}>{r}</span>)}
                </div>
              </details>

              <div className="flex gap-2">
                {status.phase === 'done' && (
                  <Button variant="outline" size="sm" onClick={reset} className="rounded-lg">
                    Clear
                  </Button>
                )}
                <Button
                  size="sm"
                  className="flex-1 rounded-lg font-bold"
                  onClick={handleImport}
                  disabled={!text.trim()}
                >
                  Import songs
                </Button>
              </div>
            </>
          ) : (
            /* Running state */
            <div className="py-4 space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">
                    Searching {status.done} of {status.total}…
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {status.added} added · {status.failed.length} failed
                  </p>
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${Math.round((status.done / status.total) * 100)}%` }}
                />
              </div>
            </div>
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
    const json = JSON.stringify(songs, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `maplog-collection-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as MaplogSong[];
        if (!Array.isArray(data)) throw new Error('Expected an array');
        let imported = 0;
        for (const song of data) {
          for (const card of song.cards ?? []) {
            addToCollection(song, card.rarityType);
            imported++;
          }
        }
        alert(`Imported ${imported} card${imported !== 1 ? 's' : ''} successfully.`);
      } catch {
        alert("Could not read the file. Make sure it's a valid Maplog export.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleClear = () => {
    if (!confirm(`Delete all ${songs.length} songs from your collection? This cannot be undone.`)) return;
    localStorage.removeItem('maplog:collection');
    window.location.reload();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 animate-in fade-in pb-24 sm:pb-8 max-w-2xl">
      <div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your Maplog experience</p>
      </div>

      {/* Batch import — sits above the other collection actions */}
      {!isDemoMode && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold tracking-widest uppercase text-muted-foreground px-1">Import</h2>
          <BatchImport searchDeezer={searchDeezer} addToCollection={addToCollection} />
        </section>
      )}

      {/* Collection actions */}
      <Section title="Collection">
        <Row
          icon={Download}
          label="Export collection"
          description={`Download your ${songs.length} song${songs.length !== 1 ? 's' : ''} as a JSON backup`}
          onClick={handleExport}
        />
        <Row
          icon={Upload}
          label="Import from backup"
          description="Restore from a previous JSON export"
          onClick={() => importRef.current?.click()}
        />
        <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImportFile} />
        {songs.length > 0 && (
          <Row
            icon={Trash2}
            label="Clear collection"
            description="Remove all songs and cards — irreversible"
            onClick={handleClear}
            destructive
          />
        )}
      </Section>

      {/* Demo mode */}
      <Section title="Demo Mode">
        <Row
          icon={Sparkles}
          label={isDemoMode ? 'Exit demo mode' : 'Enter demo mode'}
          description={
            isDemoMode
              ? 'Switch back to your real collection'
              : 'Browse 10 fictional sample cards — no account needed'
          }
          onClick={isDemoMode ? exitDemoMode : enterDemoMode}
        />
      </Section>

      {/* Audio */}
      <Section title="Audio">
        <Row
          icon={Info}
          label="30-second previews via Deezer"
          description="Maplog uses Deezer's public API for track search and 30s audio previews — no account or login required. Full Apple Music playback will be added once developer enrollment is approved."
        />
      </Section>

      {/* About */}
      <Section title="About">
        <Row icon={Shield} label="Maplog" description="Your personal Soundmap preservation archive">
          <span className="text-xs font-mono text-muted-foreground shrink-0">v1.0.0</span>
        </Row>
        <Row
          icon={ExternalLink}
          label="Soundmap"
          description="The original card game this app preserves"
          onClick={() => window.open('https://soundmap.app', '_blank')}
        />
      </Section>
    </div>
  );
}
