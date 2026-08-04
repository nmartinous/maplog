import React, { useState } from 'react';
import { useMusicKit } from '@/context/MusicKitContext';
import { Button } from '@/components/ui/button';
import {
  Music2, ExternalLink, Copy, Check, ChevronRight,
  ChevronLeft, AlertCircle, Sparkles, Link2, Hash,
} from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** The URL Deezer needs — the current page's origin + base path */
function getRedirectUrl(): string {
  const base = import.meta.env.BASE_URL ?? '/';
  // Strip trailing slash so we can normalise it
  const clean = base.endsWith('/') ? base : base + '/';
  return `${window.location.origin}${clean}`;
}

// ── Step components ────────────────────────────────────────────────────────────

function StepDot({ active, done }: { active: boolean; done: boolean }) {
  return (
    <div className={`w-2 h-2 rounded-full transition-all ${
      done ? 'bg-primary' : active ? 'bg-primary/70 scale-125' : 'bg-muted-foreground/30'
    }`} />
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

const STEPS = ['Welcome', 'Create app', 'Set URL', 'App ID'];

export default function Setup() {
  const { setAppId, enterDemoMode } = useMusicKit();
  const [step, setStep] = useState(0);
  const [appIdInput, setAppIdInput] = useState('');
  const [error, setError] = useState('');

  const redirectUrl = getRedirectUrl();

  const handleConnect = () => {
    const clean = appIdInput.trim();
    if (!clean) { setError('Paste your App ID above.'); return; }
    if (!/^\d+$/.test(clean)) {
      setError('The App ID is a number — e.g. 123456. Check the Deezer developer page.');
      return;
    }
    setError('');
    setAppId(clean);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm flex flex-col gap-6">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1a1a1e] to-[#09090b] border border-white/10 flex items-center justify-center shadow-[0_0_40px_-8px_#FF3C00]">
            <Music2 className="w-8 h-8 text-[#FF3C00]" />
          </div>
          <span className="text-xs font-semibold tracking-widest text-muted-foreground/50 uppercase">Maplog</span>
        </div>

        {/* Step dots */}
        {step > 0 && (
          <div className="flex justify-center gap-2">
            {STEPS.slice(1).map((_, i) => (
              <StepDot key={i} active={step === i + 1} done={step > i + 1} />
            ))}
          </div>
        )}

        {/* ── Step 0: Welcome ── */}
        {step === 0 && (
          <div className="flex flex-col gap-6 text-center">
            <div>
              <h1 className="text-2xl font-extrabold mb-2">Connect your collection</h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Maplog uses your <strong className="text-foreground">Deezer account</strong> as the database for your
                Soundmap cards. Setup takes about 2 minutes and requires a <em>free</em> Deezer developer account.
              </p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/20 divide-y divide-border/40 text-left text-sm overflow-hidden">
              {[
                { icon: '🆓', text: 'Free — no paid Deezer plan needed' },
                { icon: '🎵', text: 'Your playlists act as the card database' },
                { icon: '🔒', text: 'Only your "Maplog ·" playlists are read' },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-3 px-4 py-3 text-muted-foreground">
                  <span className="text-base">{icon}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <Button size="lg" className="w-full rounded-xl font-bold" onClick={() => setStep(1)}>
                Get started <ChevronRight className="ml-1 w-4 h-4" />
              </Button>
              <button
                onClick={enterDemoMode}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border/50 text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-border hover:bg-white/[0.03] transition-all"
              >
                <Sparkles className="w-4 h-4 text-[#FF3C00]/70" />
                Try Demo
                <span className="text-xs font-normal text-muted-foreground/40 ml-1">no account needed</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Step 1: Create app ── */}
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-xs font-semibold tracking-widest text-[#FF3C00]/70 uppercase mb-2">Step 1 of 3</p>
              <h2 className="text-xl font-extrabold mb-2">Create a Deezer developer app</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                You need a free Deezer developer account to get an App ID. The app name and description
                don't matter — fill them in with anything.
              </p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/20 divide-y divide-border/40 overflow-hidden text-sm">
              <div className="px-4 py-3 flex items-start gap-3 text-muted-foreground">
                <span className="shrink-0 w-5 h-5 rounded-full bg-[#FF3C00]/15 text-[#FF3C00] text-xs font-bold flex items-center justify-center mt-0.5">1</span>
                <span>Sign in to <strong className="text-foreground">developers.deezer.com</strong></span>
              </div>
              <div className="px-4 py-3 flex items-start gap-3 text-muted-foreground">
                <span className="shrink-0 w-5 h-5 rounded-full bg-[#FF3C00]/15 text-[#FF3C00] text-xs font-bold flex items-center justify-center mt-0.5">2</span>
                <span>Click <strong className="text-foreground">Create a new Application</strong></span>
              </div>
              <div className="px-4 py-3 flex items-start gap-3 text-muted-foreground">
                <span className="shrink-0 w-5 h-5 rounded-full bg-[#FF3C00]/15 text-[#FF3C00] text-xs font-bold flex items-center justify-center mt-0.5">3</span>
                <span>Fill in any name and description, then save</span>
              </div>
            </div>

            <a
              href="https://developers.deezer.com/myapps"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#FF3C00]/10 border border-[#FF3C00]/30 text-[#FF3C00] font-semibold text-sm hover:bg-[#FF3C00]/20 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open Deezer Developers
            </a>

            <div className="flex gap-3">
              <button onClick={() => setStep(0)} className="flex items-center gap-1 text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <Button className="flex-1 rounded-xl font-bold" onClick={() => setStep(2)}>
                I've created the app <ChevronRight className="ml-1 w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Set redirect URL ── */}
        {step === 2 && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-xs font-semibold tracking-widest text-[#FF3C00]/70 uppercase mb-2">Step 2 of 3</p>
              <h2 className="text-xl font-extrabold mb-2">Set the redirect URL</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                In your new Deezer app's settings, paste this URL into <strong className="text-foreground">both</strong>{' '}
                the <em>Application domain</em> and <em>Redirect URL after authentication</em> fields.
              </p>
            </div>

            {/* URL display */}
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                <Link2 className="w-3.5 h-3.5" />
                <span className="font-semibold uppercase tracking-wider">Your redirect URL</span>
              </div>
              <div className="font-mono text-sm text-foreground break-all bg-black/20 rounded-xl px-3 py-2 border border-white/5">
                {redirectUrl}
              </div>
              <CopyButton text={redirectUrl} />
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-400/80 leading-relaxed">
              <strong className="text-amber-400">Tip:</strong> If Maplog is served from a different URL later,
              add that URL to the redirect list too.
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <Button className="flex-1 rounded-xl font-bold" onClick={() => setStep(3)}>
                Done, next <ChevronRight className="ml-1 w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: App ID ── */}
        {step === 3 && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-xs font-semibold tracking-widest text-[#FF3C00]/70 uppercase mb-2">Step 3 of 3</p>
              <h2 className="text-xl font-extrabold mb-2">Paste your App ID</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Back on your app's settings page, find the <strong className="text-foreground">Application ID</strong>{' '}
                — it's a plain number, like <code className="text-[#FF3C00] bg-[#FF3C00]/10 px-1.5 py-0.5 rounded-md font-mono">123456</code>. Paste it below.
              </p>
            </div>

            {/* Visual hint */}
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground/60 mb-1">
                <Hash className="w-3.5 h-3.5" />
                <span className="font-semibold uppercase tracking-wider">Where to find it</span>
              </div>
              <div className="text-sm text-muted-foreground leading-relaxed">
                On the <strong className="text-foreground">developers.deezer.com/myapps</strong> page, click your app.
                The Application ID is shown at the top of the page.
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-foreground block mb-2">
                Deezer Application ID
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d*"
                className="w-full rounded-xl bg-muted/40 border border-border/60 px-4 py-3 text-lg font-mono text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-[#FF3C00]/40 transition-shadow"
                placeholder="123456"
                value={appIdInput}
                onChange={e => { setAppIdInput(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleConnect()}
                autoComplete="off"
                spellCheck={false}
                autoFocus
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex items-center gap-1 text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <Button
                className="flex-1 rounded-xl font-bold"
                onClick={handleConnect}
                disabled={!appIdInput.trim()}
              >
                Connect Maplog
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
