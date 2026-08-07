import React, { useMemo, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { motion } from 'framer-motion';
import { ArrowLeft, Coins, Calculator, Trophy, Info, ChartColumn, X } from 'lucide-react';
import { useMusicKit } from '@/context/MusicKitContext';
import { vaultEntries, computeVaultStatsFromEntries } from '@/lib/vaultStats';
import { RARITY_VALUES, MODIFIER_VALUES } from '@/lib/profile';
import { labelForTags } from '@/lib/tags';
import { HoldValue } from '@/components/HoldValue';
import { abbreviateValue, exactValue } from '@/lib/format';
import { cn } from '@/lib/utils';

// Colors per tag-pool label; fallbacks cycle for anything new.
const LABEL_COLORS: Record<string, string> = {
  'Common':         '#4ade80',
  'Uncommon':       '#d946ef',
  'Rare':           '#f97316',
  'Shiny Common':   '#2dd4bf',
  'Shiny Uncommon': '#e879f9',
  'Shiny Rare':     '#fbbf24',
};
const COLOR_FALLBACK = ['#38bdf8', '#facc15', '#f472b6', '#a78bfa', '#f87171', '#34d399'];
const labelColor = (label: string, i: number) =>
  LABEL_COLORS[label] ?? COLOR_FALLBACK[i % COLOR_FALLBACK.length];

// Tag filter chips shown in the Vault (label → required tags)
const FILTERS: { label: string; tags: string[] }[] = [
  { label: 'All',      tags: [] },
  { label: 'Common',   tags: ['common'] },
  { label: 'Uncommon', tags: ['uncommon'] },
  { label: 'Rare',     tags: ['rare'] },
  { label: 'Shiny',    tags: ['shiny'] },
];

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <Icon className="w-5 h-5 text-primary" />
      <h2 className="text-sm font-bold tracking-widest uppercase text-white/80">{title}</h2>
    </div>
  );
}

/** Horizontal value bars per tag-pool label */
function ValueBars({ data }: { data: { label: string; count: number; value: number }[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="space-y-4">
      {data.map((d, i) => (
        <div key={d.label}>
          <div className="flex justify-between items-baseline mb-1.5 gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-white/70 truncate">
              {d.label} <span className="text-white/35 normal-case tracking-normal">× {d.count}</span>
            </span>
            <span className="text-sm font-display font-black text-white shrink-0"><HoldValue value={d.value} /></span>
          </div>
          <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(d.value / max) * 100}%` }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: i * 0.06 }}
              className="h-full rounded-full"
              style={{ background: labelColor(d.label, i) }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** SVG donut of value share per label */
function ValueDonut({ data }: { data: { label: string; value: number }[] }) {
  const priced = data.filter(d => d.value > 0);
  const total = priced.reduce((n, d) => n + d.value, 0);
  if (total === 0) return null;
  const R = 64, r = 38, C = 80;
  let angle = -Math.PI / 2;
  const slices = priced.map((d, i) => {
    const frac = d.value / total;
    const a0 = angle;
    const a1 = (angle += frac * Math.PI * 2);
    const large = frac > 0.5 ? 1 : 0;
    const p = (a: number, rad: number) => `${C + Math.cos(a) * rad},${C + Math.sin(a) * rad}`;
    const path = total === d.value
      ? null
      : `M ${p(a0, R)} A ${R} ${R} 0 ${large} 1 ${p(a1, R)} L ${p(a1, r)} A ${r} ${r} 0 ${large} 0 ${p(a0, r)} Z`;
    return { ...d, path, frac, color: labelColor(d.label, i) };
  });
  return (
    <div className="flex items-center gap-6 justify-center flex-wrap">
      <svg width="160" height="160" viewBox="0 0 160 160" className="shrink-0">
        {slices.map(s => s.path
          ? <path key={s.label} d={s.path} fill={s.color} stroke="#0a0a0c" strokeWidth="2" />
          : <circle key={s.label} cx={C} cy={C} r={(R + r) / 2} fill="none" stroke={s.color} strokeWidth={R - r} />,
        )}
        <text x={C} y={C - 4} textAnchor="middle" className="fill-white font-display" style={{ fontSize: 18, fontWeight: 900 }}>
          {abbreviateValue(total)}
        </text>
        <text x={C} y={C + 14} textAnchor="middle" className="fill-white/40" style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5 }}>VALUE</text>
      </svg>
      <div className="space-y-2">
        {slices.map(s => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className="text-xs font-bold text-white/80">{s.label}</span>
            <span className="text-xs text-white/40">{Math.round(s.frac * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RankingList({ items }: { items: { key: string; name: string; sub?: string; artworkUrl: string | null; count: number; value: number }[] }) {
  if (items.length === 0) return <p className="text-sm text-white/40">Nothing here yet.</p>;
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={it.key} className="flex items-center gap-3 rounded-2xl bg-white/[0.03] border border-white/5 px-3 py-2.5">
          <span className="w-6 text-center font-display font-black text-white/30 text-sm shrink-0">{i + 1}</span>
          {it.artworkUrl ? (
            <img src={it.artworkUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-white/5 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{it.name}</p>
            <p className="text-[11px] text-white/40 truncate">
              {it.sub ? `${it.sub} · ` : ''}{it.count} card{it.count === 1 ? '' : 's'}
            </p>
          </div>
          <span className="font-display font-black text-white shrink-0"><HoldValue value={it.value} /></span>
        </div>
      ))}
    </div>
  );
}

/** Tag-combination value calculator */
function ValueCalculator() {
  const [base, setBase] = useState<'common' | 'uncommon' | 'rare'>('uncommon');
  const [mods, setMods] = useState<string[]>(['shiny']);

  const modifierOptions = Object.keys(MODIFIER_VALUES);
  const toggleMod = (m: string) =>
    setMods(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);

  const value = mods.reduce((v, m) => v * (MODIFIER_VALUES[m] ?? 1), RARITY_VALUES[base]);
  const label = labelForTags(['regular', base, ...mods]);

  const chip = (active: boolean) => cn(
    'px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border transition-colors',
    active ? 'bg-primary text-white border-primary' : 'bg-white/5 text-white/60 border-white/10',
  );

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-2">Base rarity</p>
        <div className="flex gap-2 flex-wrap">
          {(['common', 'uncommon', 'rare'] as const).map(b => (
            <button key={b} className={chip(base === b)} onClick={() => setBase(b)} data-testid={`calc-base-${b}`}>
              {b} · {abbreviateValue(RARITY_VALUES[b])}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-2">Modifiers</p>
        <div className="flex gap-2 flex-wrap">
          {modifierOptions.map(m => (
            <button key={m} className={chip(mods.includes(m))} onClick={() => toggleMod(m)} data-testid={`calc-mod-${m}`}>
              {labelForTags(['regular', 'common', m]).replace(' Common', '')} · ×{MODIFIER_VALUES[m]}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-2xl bg-white/[0.04] border border-white/10 px-4 py-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-white truncate">{label}</p>
          <p className="text-[11px] text-white/40">
            {exactValue(RARITY_VALUES[base])}{mods.map(m => ` × ${MODIFIER_VALUES[m]}`).join('')}
          </p>
        </div>
        <span className="text-2xl font-display font-black text-primary shrink-0" data-testid="calc-result">
          <HoldValue value={value} />
        </span>
      </div>
    </div>
  );
}

export default function Vault() {
  const { songs } = useMusicKit();
  const [, navigate] = useLocation();
  const search = useSearch();

  // Pre-filter support (e.g. /vault?artist=Kordhell from future artist pages)
  const artistFilter = useMemo(
    () => new URLSearchParams(search).get('artist') ?? undefined,
    [search],
  );

  const [filterIdx, setFilterIdx] = useState(0);

  // Flatten once per collection change; filter toggles only re-aggregate.
  const entries = useMemo(() => vaultEntries(songs), [songs]);
  const stats = useMemo(
    () => computeVaultStatsFromEntries(entries, { tags: FILTERS[filterIdx].tags, artist: artistFilter }),
    [entries, filterIdx, artistFilter],
  );

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden scrollbar-hide bg-background pb-20">
      <div className="page-top px-4 sm:px-6 pb-6 relative z-10 max-w-2xl mx-auto">
        {/* ── Header ── */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/profile')}
            aria-label="Back to profile"
            className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center active:scale-90 transition-transform"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-2xl font-display font-black tracking-tight text-white leading-none">Vault</h1>
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mt-1">Collection valuation</p>
          </div>
        </div>

        {artistFilter && (
          <button
            onClick={() => navigate('/vault')}
            className="mb-5 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/15 border border-primary/40 text-primary text-xs font-bold"
            data-testid="vault-artist-filter"
          >
            {artistFilter}
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* ── Total ── */}
        <div className="glass-panel rounded-2xl p-6 relative overflow-hidden mb-8">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <p className="text-5xl font-display font-black tracking-tight text-white mb-1" data-testid="vault-total">
            <HoldValue value={stats.totalValue} />
          </p>
          <p className="text-sm font-bold text-white/50 mb-1">{exactValue(stats.totalValue)}</p>
          <p className="text-xs font-bold uppercase tracking-widest text-white/40">
            {stats.totalCards} card{stats.totalCards === 1 ? '' : 's'} · {stats.totalTracks} track{stats.totalTracks === 1 ? '' : 's'}
            {stats.unpricedCount > 0 && ` · ${stats.unpricedCount} unpriced`}
          </p>
        </div>

        {/* ── Filters ── */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 mb-8">
          {FILTERS.map((f, i) => (
            <button
              key={f.label}
              onClick={() => setFilterIdx(i)}
              data-testid={`vault-filter-${f.label.toLowerCase()}`}
              className={cn(
                'px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider border whitespace-nowrap transition-colors',
                filterIdx === i ? 'bg-primary text-white border-primary' : 'bg-white/5 text-white/60 border-white/10',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {stats.totalCards === 0 ? (
          <div className="text-center py-16">
            <Coins className="h-14 w-14 mx-auto mb-5 text-white/10" />
            <p className="text-white/50">No cards match this filter yet.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {/* ── Graphs ── */}
            <section>
              <SectionHeader icon={ChartColumn} title="Value by rarity" />
              <div className="glass-panel rounded-2xl p-5">
                <ValueBars data={stats.byLabel} />
              </div>
            </section>

            {stats.byLabel.filter(d => d.value > 0).length > 1 && (
              <section>
                <SectionHeader icon={Coins} title="Value share" />
                <div className="glass-panel rounded-2xl p-5">
                  <ValueDonut data={stats.byLabel} />
                </div>
              </section>
            )}

            {/* ── Rankings ── */}
            <section>
              <SectionHeader icon={Trophy} title="Most valuable artists" />
              <RankingList items={stats.topArtists} />
            </section>
            <section>
              <SectionHeader icon={Trophy} title="Most valuable tracks" />
              <RankingList items={stats.topTracks} />
            </section>
          </div>
        )}

        {/* ── Calculator ── */}
        <section className="mt-10">
          <SectionHeader icon={Calculator} title="Value calculator" />
          <div className="glass-panel rounded-2xl p-5">
            <ValueCalculator />
          </div>
        </section>

        {/* ── Methodology ── */}
        <section className="mt-10">
          <SectionHeader icon={Info} title="How value is calculated" />
          <div className="glass-panel rounded-2xl p-5 space-y-3 text-sm text-white/60 leading-relaxed">
            <p>
              Every card starts from its <span className="text-white font-bold">base rarity</span> value:
              Common {exactValue(RARITY_VALUES.common)}, Uncommon {exactValue(RARITY_VALUES.uncommon)},
              Rare {exactValue(RARITY_VALUES.rare)}.
            </p>
            <p>
              <span className="text-white font-bold">Modifiers multiply</span> that base — a Shiny card is worth
              ×{MODIFIER_VALUES.shiny} its base, so a Shiny Uncommon is {exactValue(RARITY_VALUES.uncommon)} × {MODIFIER_VALUES.shiny} = {exactValue(RARITY_VALUES.uncommon * MODIFIER_VALUES.shiny)}.
            </p>
            <p>
              <span className="text-white font-bold">Epics are priced by their number</span>: #1 is worth 150,000,
              #25 is 30,000, and #100 or beyond is 15,000, with everything in between following an exponential
              curve through those points (rounded down). Unnumbered epics are a flat 20,000.
            </p>
            <p>
              Moments, Lyrics and Radiants don't have a price yet — they show as
              <span className="text-white font-bold"> unpriced</span> and count toward totals at 0 until their
              valuation lands.
            </p>
            <p className="text-white/40 text-xs">
              Press and hold any abbreviated number anywhere in Maplog to reveal the exact figure.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
