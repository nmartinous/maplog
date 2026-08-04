import React, { useState } from 'react';
import { useMusicKit } from '@/context/MusicKitContext';
import { Button } from '@/components/ui/button';
import { Music2, ExternalLink, ChevronRight, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';

export default function Setup() {
  const { setAppId, enterDemoMode } = useMusicKit();
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const handleSave = () => {
    const clean = input.trim();
    if (!clean) { setError('Paste your Deezer App ID above.'); return; }
    if (!/^\d+$/.test(clean)) {
      setError('The App ID should be a number — check the Application page on developers.deezer.com.');
      return;
    }
    setError('');
    setAppId(clean);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-12 text-center">
      {/* Logo */}
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center mb-6 shadow-[0_0_40px_-8px_var(--color-primary)]">
        <Music2 className="w-10 h-10 text-primary" />
      </div>

      <h1 className="text-3xl font-extrabold mb-2">Connect Deezer</h1>
      <p className="text-muted-foreground text-sm mb-10 max-w-sm leading-relaxed">
        Maplog reads your Deezer playlists to display your card collection.
        A free Deezer developer App ID is required — no paid plan needed.
      </p>

      <div className="w-full max-w-sm space-y-4 text-left">
        <Step n={1} title="Create a Deezer developer app">
          Sign in at{' '}
          <a href="https://developers.deezer.com/myapps" target="_blank" rel="noopener"
            className="text-primary underline underline-offset-2 inline-flex items-center gap-0.5">
            developers.deezer.com/myapps <ExternalLink className="w-3 h-3" />
          </a>{' '}
          and click <strong>Create a new Application</strong>. Fill in any name and description — the
          details don't matter for personal use.
        </Step>

        <Step n={2} title="Set the redirect URL">
          In your new app's settings, find the <strong>Application domain</strong> and{' '}
          <strong>Redirect URL after authentication</strong> fields. Set both to your app's URL
          (the address shown in your browser's address bar).
        </Step>

        <Step n={3} title="Copy your App ID">
          After saving, you'll see your{' '}
          <strong>Application ID</strong> — it's a plain number like{' '}
          <code className="text-primary bg-primary/10 px-1 rounded">123456</code>.
          Paste it below.
        </Step>

        {/* App ID input */}
        <div className="pt-1">
          <label className="text-sm font-semibold text-foreground block mb-2">
            Deezer App ID
          </label>
          <input
            type="text"
            inputMode="numeric"
            pattern="\d*"
            className="w-full rounded-xl bg-muted/40 border border-border/60 px-4 py-3 text-base font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="123456"
            value={input}
            onChange={e => { setInput(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <Button
          className="w-full rounded-xl font-bold"
          size="lg"
          onClick={handleSave}
          disabled={!input.trim()}
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Save &amp; Connect
        </Button>

        {/* Demo mode */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border/40" />
          <span className="text-xs text-muted-foreground/50 font-medium">or</span>
          <div className="flex-1 h-px bg-border/40" />
        </div>

        <button
          onClick={enterDemoMode}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border/50 text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-border hover:bg-white/[0.03] transition-all"
        >
          <Sparkles className="w-4 h-4 text-primary/70" />
          Try Demo
          <span className="text-xs font-normal text-muted-foreground/50 ml-1">no account needed</span>
        </button>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-7 h-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary text-xs font-bold mt-0.5">
        {n}
      </div>
      <div>
        <p className="font-semibold text-sm mb-1">{title}</p>
        <div className="text-sm text-muted-foreground leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
