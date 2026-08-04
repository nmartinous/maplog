import React, { useRef } from 'react';
import { useMusicKit } from '@/context/MusicKitContext';
import type { MaplogSong } from '@/lib/types';
import {
  Trash2, Download, Upload, Sparkles, Shield, ExternalLink,
  Info, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

export default function Settings() {
  const { songs, enterDemoMode, exitDemoMode, isDemoMode, addToCollection } = useMusicKit();
  const importRef = useRef<HTMLInputElement>(null);

  // ── Export ────────────────────────────────────────────────────────────────

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

  // ── Import ────────────────────────────────────────────────────────────────

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
        alert('Could not read the file. Make sure it\'s a valid Maplog export.');
      }
    };
    reader.readAsText(file);
    // reset so the same file can be re-selected
    e.target.value = '';
  };

  // ── Clear ─────────────────────────────────────────────────────────────────

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

      {/* Collection */}
      <Section title="Collection">
        <Row
          icon={Download}
          label="Export collection"
          description={`Download your ${songs.length} song${songs.length !== 1 ? 's' : ''} as a JSON backup`}
          onClick={handleExport}
        />
        <Row
          icon={Upload}
          label="Import collection"
          description="Restore from a previous JSON export"
          onClick={() => importRef.current?.click()}
        />
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleImportFile}
        />
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
              : 'Browse with 10 fictional sample cards — no account needed'
          }
          onClick={isDemoMode ? exitDemoMode : enterDemoMode}
        />
      </Section>

      {/* Audio info */}
      <Section title="Audio">
        <Row
          icon={Info}
          label="30-second previews"
          description="Maplog plays track previews from Deezer's public API. No account or login required — previews are always available."
        />
      </Section>

      {/* About */}
      <Section title="About">
        <Row
          icon={Shield}
          label="Maplog"
          description="Your personal Soundmap preservation archive"
        >
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
