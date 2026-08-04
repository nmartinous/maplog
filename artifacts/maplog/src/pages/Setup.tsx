import React, { useState } from 'react';
import { useMusicKit } from '@/context/MusicKitContext';
import { Button } from '@/components/ui/button';
import { Music2, ExternalLink, ChevronRight, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';

export default function Setup() {
  const { setDeveloperToken, enterDemoMode } = useMusicKit();
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState<1 | 2>(1);

  const handleSave = () => {
    const clean = token.trim();
    if (!clean) { setError('Paste your developer token above.'); return; }
    if (clean.split('.').length !== 3) {
      setError("That doesn't look like a valid JWT. Make sure you copied the full token.");
      return;
    }
    setError('');
    setDeveloperToken(clean);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-12 text-center">
      {/* Logo */}
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center mb-6 shadow-[0_0_40px_-8px_var(--color-primary)]">
        <Music2 className="w-10 h-10 text-primary" />
      </div>

      <h1 className="text-3xl font-extrabold mb-2">Connect Apple Music</h1>
      <p className="text-muted-foreground text-sm mb-10 max-w-sm leading-relaxed">
        Maplog reads your Apple Music playlists to display your card collection.
        A one-time Apple Developer token is required to access the API.
      </p>

      {step === 1 ? (
        /* ── Step 1: Explain ──────────────────────────────────────────────── */
        <div className="w-full max-w-sm space-y-3 text-left">
          <Step n={1} title="Create an Apple Developer key">
            Sign in at <a href="https://developer.apple.com" target="_blank" rel="noopener" className="text-primary underline underline-offset-2">developer.apple.com</a> →
            {' '}Certificates, IDs &amp; Profiles → Keys → New Key.
            Check <strong>MusicKit</strong> and download the <code className="text-primary bg-primary/10 px-1 rounded">.p8</code> file.
            Note your <strong>Key ID</strong> and <strong>Team ID</strong>.
          </Step>

          <Step n={2} title="Generate a JWT token">
            Use a tool like{' '}
            <a
              href="https://github.com/pelauimagineering/apple-music-token-generator"
              target="_blank" rel="noopener"
              className="text-primary underline underline-offset-2 inline-flex items-center gap-0.5"
            >
              apple-music-token-generator <ExternalLink className="w-3 h-3" />
            </a>{' '}
            or the command below to sign a JWT with your <code className="text-primary bg-primary/10 px-1 rounded">.p8</code> key:
            <pre className="mt-2 text-[11px] bg-muted/40 rounded-xl p-3 overflow-x-auto text-muted-foreground leading-relaxed whitespace-pre-wrap break-all">
{`npx apple-music-jwt \\
  --key-id  YOUR_KEY_ID \\
  --team-id YOUR_TEAM_ID \\
  --key-file AuthKey_KEYID.p8`}
            </pre>
          </Step>

          <Step n={3} title="Paste the token below">
            The token is a long string starting with <code className="text-primary bg-primary/10 px-1 rounded">eyJ…</code>.
            It's valid for up to 6 months; you'll need to regenerate it when it expires.
          </Step>

          <Button
            className="w-full mt-4 rounded-xl font-bold"
            size="lg"
            onClick={() => setStep(2)}
          >
            I have my token <ChevronRight className="ml-1 h-4 w-4" />
          </Button>

          {/* Demo mode separator */}
          <div className="flex items-center gap-3 pt-1">
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
      ) : (
        /* ── Step 2: Paste token ──────────────────────────────────────────── */
        <div className="w-full max-w-sm space-y-4">
          <div className="text-left">
            <label className="text-sm font-semibold text-foreground block mb-2">
              Paste your developer token
            </label>
            <textarea
              className="w-full h-32 rounded-xl bg-muted/40 border border-border/60 px-4 py-3 text-[12px] font-mono text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 leading-relaxed"
              placeholder="eyJhbGciOiJFUzI1NiIsImtpZCI6IkFCQ0RFRkdIIn0…"
              value={token}
              onChange={e => { setToken(e.target.value); setError(''); }}
              spellCheck={false}
              autoComplete="off"
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
            disabled={!token.trim()}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Save &amp; Connect
          </Button>

          <button
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setStep(1)}
          >
            ← Back to instructions
          </button>
        </div>
      )}
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
        {/* Use div so block-level children (pre) don't cause invalid nesting */}
        <div className="text-sm text-muted-foreground leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
