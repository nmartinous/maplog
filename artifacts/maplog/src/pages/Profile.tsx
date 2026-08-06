import React, { useMemo, useRef, useState } from 'react';
import { useMusicKit } from '@/context/MusicKitContext';
import { Disc3, Layers, Sparkles, Star, Trophy, Target, Check, Coins, Camera, ChevronRight } from 'lucide-react';
import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  loadProfile, saveProfile, fileToAvatar, cardValue,
  type CollectorProfile,
} from '@/lib/profile';
import { toast } from 'sonner';
import { abbreviateValue, exactValue } from '@/lib/format';
import { ShowcaseSection } from '@/components/ShowcaseSection';

function StatCard({ label, value, icon: Icon, delay = 0 }: { label: string; value: string | number; icon: React.ElementType, delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', damping: 20 }}
      className="glass-panel rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden group"
    >
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-colors pointer-events-none" />
      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center shrink-0 border border-white/10 group-hover:scale-110 group-hover:bg-primary/20 group-hover:text-primary transition-all">
        <Icon className="h-6 w-6 text-white/70 group-hover:text-primary transition-colors" />
      </div>
      <div>
        <p className="text-3xl font-display font-black tracking-tight text-white mb-1">{value}</p>
        <p className="text-sm font-semibold text-white/50 uppercase tracking-wider">{label}</p>
      </div>
    </motion.div>
  );
}

const RARITY_COLORS: Record<string, string> = {
  Rare:     'bg-orange-500/10 border-orange-500/30 text-orange-400',
  Uncommon: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
  Common:   'bg-green-500/10 border-green-500/30 text-green-400',
  Regular:  'bg-white/5 border-white/10 text-white',
};

const PIE_COLORS: Record<string, string> = {
  Rare: '#f97316',
  Uncommon: '#d946ef',
  Common: '#4ade80',
};
const PIE_FALLBACK = ['#38bdf8', '#facc15', '#f472b6', '#a78bfa', '#f87171'];

/** SVG donut chart for rarity counts */
function RarityPie({ data }: { data: { name: string; count: number }[] }) {
  const total = data.reduce((n, d) => n + d.count, 0);
  if (total === 0) return null;
  const R = 64, r = 38, C = 80;
  let angle = -Math.PI / 2;
  const slices = data.map((d, i) => {
    const frac = d.count / total;
    const a0 = angle;
    const a1 = (angle += frac * Math.PI * 2);
    const large = frac > 0.5 ? 1 : 0;
    const p = (a: number, rad: number) => `${C + Math.cos(a) * rad},${C + Math.sin(a) * rad}`;
    const path = total === d.count
      ? null // full circle — render as two arcs below
      : `M ${p(a0, R)} A ${R} ${R} 0 ${large} 1 ${p(a1, R)} L ${p(a1, r)} A ${r} ${r} 0 ${large} 0 ${p(a0, r)} Z`;
    return { ...d, path, frac, color: PIE_COLORS[d.name] ?? PIE_FALLBACK[i % PIE_FALLBACK.length] };
  });

  return (
    <div className="flex items-center gap-6 justify-center">
      <svg width="160" height="160" viewBox="0 0 160 160" className="shrink-0">
        {slices.map(s => s.path
          ? <path key={s.name} d={s.path} fill={s.color} stroke="#0a0a0c" strokeWidth="2" />
          : <circle key={s.name} cx={C} cy={C} r={(R + r) / 2} fill="none" stroke={s.color} strokeWidth={R - r} />,
        )}
        <text x={C} y={C - 4} textAnchor="middle" className="fill-white font-display" style={{ fontSize: 22, fontWeight: 900 }}>{total}</text>
        <text x={C} y={C + 14} textAnchor="middle" className="fill-white/40" style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5 }}>CARDS</text>
      </svg>
      <div className="space-y-2">
        {slices.map(s => (
          <div key={s.name} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className="text-xs font-bold text-white/80">{s.name}</span>
            <span className="text-xs text-white/40">{Math.round(s.frac * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Horizontal bar view for rarity counts */
function RarityBars({ data }: { data: { name: string; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="space-y-4 w-full px-1">
      {data.map((d, i) => {
        const color = PIE_COLORS[d.name] ?? PIE_FALLBACK[i % PIE_FALLBACK.length];
        return (
          <div key={d.name}>
            <div className="flex justify-between items-baseline mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-white/70">{d.name}</span>
              <span className="text-sm font-display font-black text-white">{d.count}</span>
            </div>
            <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(d.count / max) * 100}%` }}
                transition={{ duration: 0.6, ease: 'easeOut', delay: i * 0.08 }}
                className="h-full rounded-full"
                style={{ background: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Profile() {
  const { songs, isDemoMode } = useMusicKit();
  const [, navigate] = useLocation();

  // ── Editable profile ────────────────────────────────────────────────────
  const [profile, setProfile] = useState<CollectorProfile>(() => loadProfile());
  const [editingName, setEditingName] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [bioDraft, setBioDraft] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const commit = (patch: Partial<CollectorProfile>) => {
    const next = { ...profile, ...patch };
    setProfile(next);
    if (!saveProfile(next)) {
      toast.error("Couldn't save your profile — storage is full.");
    }
  };

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      commit({ avatar: await fileToAvatar(file) });
    } catch {
      toast.error('Could not read that image.');
    }
  };

  // ── Stats ───────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalSongs = songs.length;
    const allCards = songs.flatMap(s => s.cards);
    const totalCards = allCards.length;
    const byRarity = Object.entries(
      allCards.reduce<Record<string, number>>((acc, card) => {
        const n = card.rarityType.name;
        acc[n] = (acc[n] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

    // Valuation total (breakdown lives in the Vault)
    let totalValue = 0;
    for (const card of allCards) {
      totalValue += cardValue(card) ?? 0;
    }
    return { totalSongs, totalCards, byRarity, totalValue };
  }, [songs]);

  // ── Distribution carousel ───────────────────────────────────────────────
  const [distView, setDistView] = useState(0);
  const distRef = useRef<HTMLDivElement>(null);
  const onDistScroll = () => {
    const el = distRef.current;
    if (!el) return;
    setDistView(Math.round(el.scrollLeft / el.clientWidth));
  };

  const fmt = (n: number) => n.toLocaleString('en-US');

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden scrollbar-hide bg-background pb-20">
      <div className="px-4 sm:px-6 pt-8 pb-6 relative z-10">
        {/* ── Editable identity header ── */}
        <div className="flex items-center gap-5 mb-8">
          <motion.button
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            onClick={() => fileRef.current?.click()}
            aria-label="Change profile picture"
            className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center shrink-0 shadow-[0_0_30px_rgba(255,60,0,0.3)] relative overflow-hidden group active:scale-95 transition-transform"
          >
            {profile.avatar ? (
              <img src={profile.avatar} alt="Profile" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <>
                <div className="absolute inset-0 bg-white/20 rounded-[2rem] rotate-45 pointer-events-none mix-blend-overlay" />
                <Trophy className="h-10 w-10 text-white" />
              </>
            )}
            <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </div>
          </motion.button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />

          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2 mb-1">
                <input
                  autoFocus
                  className="flex-1 min-w-0 h-11 rounded-2xl bg-white/5 border border-white/10 px-4 text-xl font-display font-black text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={nameDraft}
                  maxLength={24}
                  onChange={e => setNameDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { commit({ name: nameDraft.trim() || 'Collector' }); setEditingName(false); }
                    if (e.key === 'Escape') setEditingName(false);
                  }}
                />
                <button
                  className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center shrink-0 active:scale-90 transition-transform"
                  onClick={() => { commit({ name: nameDraft.trim() || 'Collector' }); setEditingName(false); }}
                  aria-label="Save name"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="group flex items-center gap-2 mb-1 min-w-0 max-w-full text-left"
                onClick={() => { setNameDraft(profile.name); setEditingName(true); }}
              >
                <h1 className="text-3xl font-display font-black tracking-tight text-white truncate">{profile.name}</h1>
              </motion.button>
            )}

            {editingBio ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  className="flex-1 min-w-0 h-9 rounded-full bg-white/5 border border-white/10 px-4 text-xs font-bold text-white uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={bioDraft}
                  maxLength={48}
                  placeholder="Your motto"
                  onChange={e => setBioDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { commit({ bio: bioDraft.trim() }); setEditingBio(false); }
                    if (e.key === 'Escape') setEditingBio(false);
                  }}
                />
                <button
                  className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shrink-0 active:scale-90 transition-transform"
                  onClick={() => { commit({ bio: bioDraft.trim() }); setEditingBio(false); }}
                  aria-label="Save motto"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                onClick={() => { setBioDraft(profile.bio); setEditingBio(true); }}
                className="group inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 max-w-full"
              >
                <span className="text-xs font-bold text-white/70 uppercase tracking-wider truncate">
                  {profile.bio || 'Add a motto'}{isDemoMode ? ' · Demo' : ''}
                </span>
              </motion.button>
            )}
          </div>
        </div>

        {songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Star className="h-16 w-16 mx-auto mb-6 text-white/10" />
            <h2 className="text-xl font-display font-bold text-white mb-2">No Stats Yet</h2>
            <p className="text-white/50 text-base max-w-xs leading-relaxed">Add cards to your collection to see your collector profile grow.</p>
          </div>
        ) : (
          <div className="space-y-10">
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Target className="w-5 h-5 text-primary" />
                <h2 className="text-sm font-bold tracking-widest uppercase text-white/80">Milestones</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <StatCard label="Total Cards" value={stats.totalCards} icon={Layers} delay={0.1} />
                <StatCard label="Unique Songs" value={stats.totalSongs} icon={Disc3} delay={0.2} />
              </div>
            </section>

            {stats.byRarity.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <h2 className="text-sm font-bold tracking-widest uppercase text-white/80">Card Distribution</h2>
                </div>
                <div
                  ref={distRef}
                  onScroll={onDistScroll}
                  className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none -mx-4 px-4"
                  style={{ scrollbarWidth: 'none' }}
                >
                  {/* View 1: count tiles */}
                  <div className="w-full shrink-0 snap-center pr-3">
                    <div className="glass-panel rounded-[1.75rem] p-5 h-full">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {stats.byRarity.map(({ name, count }) => (
                          <div
                            key={name}
                            className={cn(
                              'rounded-2xl border px-5 py-4 flex flex-col gap-2',
                              RARITY_COLORS[name] ?? 'bg-white/5 border-white/10 text-white',
                            )}
                          >
                            <span className="font-display font-black text-2xl">{count}</span>
                            <span className="text-xs font-bold uppercase tracking-wider opacity-80">{name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* View 2: pie chart */}
                  <div className="w-full shrink-0 snap-center pr-3">
                    <div className="glass-panel rounded-[1.75rem] p-5 h-full flex items-center justify-center">
                      <RarityPie data={stats.byRarity} />
                    </div>
                  </div>
                  {/* View 3: bars */}
                  <div className="w-full shrink-0 snap-center">
                    <div className="glass-panel rounded-[1.75rem] p-5 h-full flex items-center">
                      <RarityBars data={stats.byRarity} />
                    </div>
                  </div>
                </div>
                <div className="flex justify-center gap-1.5 mt-3">
                  {[0, 1, 2].map(i => (
                    <button
                      key={i}
                      aria-label={`Distribution view ${i + 1}`}
                      onClick={() => distRef.current?.scrollTo({ left: i * distRef.current.clientWidth, behavior: 'smooth' })}
                      className={cn(
                        'h-1.5 rounded-full transition-all duration-300',
                        distView === i ? 'w-5 bg-primary' : 'w-1.5 bg-white/20',
                      )}
                    />
                  ))}
                </div>
              </section>
            )}

            <section>
              <div className="flex items-center gap-3 mb-4">
                <Star className="w-5 h-5 text-primary" />
                <h2 className="text-sm font-bold tracking-widest uppercase text-white/80">Showcase</h2>
              </div>
              <ShowcaseSection scope={{ kind: 'profile' }} songs={songs} readOnly={isDemoMode} />
            </section>

            <section className="pb-4">
              <div className="flex items-center gap-3 mb-4">
                <Coins className="w-5 h-5 text-primary" />
                <h2 className="text-sm font-bold tracking-widest uppercase text-white/80">Collection Valuation</h2>
              </div>
              <button
                onClick={() => navigate('/vault')}
                data-testid="open-vault"
                className="glass-panel rounded-[1.75rem] p-5 relative overflow-hidden w-full text-left active:scale-[0.98] transition-transform group"
              >
                <div className="absolute -right-8 -top-8 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-4xl font-display font-black tracking-tight text-white mb-1">
                      {abbreviateValue(stats.totalValue)}
                    </p>
                    <p
                      className="font-bold text-white/50 leading-none mb-2 truncate"
                      style={{
                        // size-adjusting: shrink as the exact number grows
                        fontSize: `clamp(0.7rem, ${Math.max(11, 22 - exactValue(stats.totalValue).length)}px, 1rem)`,
                      }}
                    >
                      {exactValue(stats.totalValue)}
                    </p>
                    <p className="text-xs font-bold uppercase tracking-widest text-white/40">
                      Total value · Open the Vault
                    </p>
                  </div>
                  <div className="w-11 h-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-active:bg-primary/20 transition-colors">
                    <ChevronRight className="w-5 h-5 text-white/60" />
                  </div>
                </div>
              </button>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
