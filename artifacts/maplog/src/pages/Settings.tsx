import React, { useState } from 'react';
import { Link } from 'wouter';
import { ExternalLink, Server, Info, Shield, RefreshCw, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { setBaseUrl } from '@workspace/api-client-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const DEFAULT_API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-bold tracking-widest uppercase text-muted-foreground px-1">{title}</h2>
      <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
        {children}
      </div>
    </section>
  );
}

function SettingsRow({ icon: Icon, label, description, children, onClick }: {
  icon: React.ElementType;
  label: string;
  description?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      className={cn("flex items-center gap-4 px-4 py-4", onClick && "cursor-pointer hover:bg-accent/50 transition-colors")}
      onClick={onClick}
    >
      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {children || (onClick && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />)}
    </div>
  );
}

export default function Settings() {
  const [apiBase, setApiBase] = useState(() =>
    localStorage.getItem('maplog_api_base') || DEFAULT_API_BASE
  );
  const [editing, setEditing] = useState(false);
  const [tempUrl, setTempUrl] = useState(apiBase);

  const handleSaveUrl = () => {
    const url = tempUrl.trim().replace(/\/$/, '');
    setApiBase(url);
    localStorage.setItem('maplog_api_base', url);
    setBaseUrl(url);
    setEditing(false);
    toast.success('API URL saved. Refresh the app to apply.');
  };

  const handleReset = () => {
    setApiBase(DEFAULT_API_BASE);
    setTempUrl(DEFAULT_API_BASE);
    localStorage.removeItem('maplog_api_base');
    setBaseUrl(DEFAULT_API_BASE);
    toast.success('Reset to default API URL.');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 animate-in fade-in pb-24 sm:pb-8 max-w-2xl">
      <div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your Maplog experience</p>
      </div>

      {/* API / Connection */}
      <SettingsSection title="Connection">
        <div className="px-4 py-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Server className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">API Base URL</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Where the Maplog API server lives. Change this if you host it elsewhere.
              </p>
            </div>
          </div>

          {editing ? (
            <div className="flex gap-2 mt-3">
              <Input
                value={tempUrl}
                onChange={(e) => setTempUrl(e.target.value)}
                className="font-mono text-sm h-10"
                placeholder="https://your-server.com/api"
                autoFocus
              />
              <Button size="sm" onClick={handleSaveUrl} className="shrink-0">Save</Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setTempUrl(apiBase); }} className="shrink-0">Cancel</Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-3">
              <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-md text-muted-foreground font-mono truncate">
                {apiBase}
              </code>
              <Button size="sm" variant="outline" onClick={() => { setEditing(true); setTempUrl(apiBase); }}>
                Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={handleReset} title="Reset to default">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </SettingsSection>

      {/* Audio Hosting guide */}
      <SettingsSection title="Audio Hosting">
        <div className="px-4 py-4 space-y-3">
          <div className="flex gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
              <Info className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-2 text-sm">
              <p className="font-semibold">Self-Host Your Audio Files</p>
              <p className="text-muted-foreground leading-relaxed">
                Maplog plays audio from direct URLs. Host your files on your home server using a static file server 
                exposed via <strong>Cloudflare Tunnel</strong> — no port forwarding required.
              </p>
              <ol className="list-decimal list-inside text-muted-foreground space-y-1 text-xs">
                <li>Install <code className="bg-muted px-1 rounded">cloudflared</code> on your home machine</li>
                <li>Run a static file server (e.g. <code className="bg-muted px-1 rounded">npx serve ~/Music</code>)</li>
                <li>Create a tunnel: <code className="bg-muted px-1 rounded">cloudflared tunnel --url http://localhost:3000</code></li>
                <li>Paste the resulting URL when adding songs in Maplog</li>
              </ol>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* About */}
      <SettingsSection title="About">
        <SettingsRow
          icon={Shield}
          label="Maplog"
          description="Your personal Soundmap preservation archive"
        >
          <span className="text-xs font-mono text-muted-foreground shrink-0">v1.0.0</span>
        </SettingsRow>
        <SettingsRow
          icon={ExternalLink}
          label="Soundmap"
          description="The original card game this app preserves"
          onClick={() => window.open('https://soundmap.app', '_blank')}
        />
      </SettingsSection>
    </div>
  );
}
