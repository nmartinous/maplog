import React from 'react';
import { cn } from '@/lib/utils';

// Rarity type slug → visual config
// Matches the slugs seeded into rarity_types table
interface BadgeConfig {
  icon: React.ReactNode;
  pill: string;        // full pill className (bg + border + text)
  label: string;       // display label
  glow?: string;       // optional box-shadow glow color
  gradient?: boolean;  // use inline gradient instead of class bg
}

const GEM = ({ color }: { color: string }) => (
  <span
    className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
    style={{ backgroundColor: color, boxShadow: `0 0 5px ${color}88` }}
  />
);

const DIAMOND = ({ color }: { color: string }) => (
  <span
    className="inline-block w-2 h-2 shrink-0 rotate-45"
    style={{ backgroundColor: color, boxShadow: `0 0 5px ${color}88` }}
  />
);

const CONFIGS: Record<string, BadgeConfig> = {
  'regular-common': {
    icon: <GEM color="#4ade80" />,
    pill: 'bg-green-950/90 border border-green-800/70 text-green-400',
    label: 'Common',
  },
  'regular-uncommon': {
    icon: <GEM color="#a78bfa" />,
    pill: 'bg-purple-950/90 border border-purple-700/70 text-purple-400',
    label: 'Uncommon',
  },
  'regular-rare': {
    icon: <GEM color="#fb923c" />,
    pill: 'bg-amber-950/90 border border-amber-700/70 text-amber-400',
    label: 'Rare',
  },
  'shiny-common': {
    icon: <GEM color="#c084fc" />,
    pill: 'bg-violet-950/90 border border-violet-600/70 text-violet-300',
    label: 'Shiny',
    glow: '#7c3aed44',
  },
  'shiny-uncommon': {
    icon: <GEM color="#818cf8" />,
    pill: 'bg-indigo-950/90 border border-indigo-600/70 text-indigo-300',
    label: 'Shiny',
    glow: '#4f46e544',
  },
  'shiny-rare': {
    icon: <GEM color="#6366f1" />,
    pill: 'bg-indigo-950/90 border border-indigo-500/70 text-indigo-200',
    label: 'Shiny Rare',
    glow: '#4338ca44',
  },
  'epic': {
    icon: <DIAMOND color="#fbbf24" />,
    pill: 'border border-amber-500/50 text-amber-100',
    label: 'Epic',
    gradient: true,
    glow: '#f59e0b55',
  },
  'epic-numbered': {
    icon: <DIAMOND color="#fbbf24" />,
    pill: 'border border-amber-500/50 text-amber-100',
    label: 'Epic',
    gradient: true,
    glow: '#f59e0b55',
  },
  'special-edition': {
    icon: <GEM color="#f472b6" />,
    pill: 'bg-pink-950/90 border border-pink-600/70 text-pink-300',
    label: 'Special Ed.',
    glow: '#db277744',
  },
  'special-epic': {
    icon: <DIAMOND color="#fb7185" />,
    pill: 'border border-rose-500/50 text-rose-100',
    label: 'Special Epic',
    gradient: true,
    glow: '#e11d4855',
  },
  'streak-epic': {
    icon: <DIAMOND color="#fb923c" />,
    pill: 'border border-orange-500/50 text-orange-100',
    label: 'Streak Epic',
    gradient: true,
    glow: '#ea580c55',
  },
  'radiant': {
    icon: <GEM color="#ffffff" />,
    pill: 'bg-white/10 border border-white/40 text-white',
    label: 'Radiant',
    glow: '#ffffff33',
  },
  'lyric': {
    icon: <GEM color="#38bdf8" />,
    pill: 'bg-sky-950/90 border border-sky-600/70 text-sky-300',
    label: 'Lyric',
  },
  'moment': {
    icon: (
      <span className="inline-block w-2.5 h-2.5 shrink-0 flex items-center justify-center">
        <span className="block w-0 h-0 border-l-[8px] border-l-purple-400 border-y-[4px] border-y-transparent" />
      </span>
    ),
    pill: 'bg-purple-950/90 border border-purple-600/70 text-purple-300',
    label: 'Moment',
  },
};

// Fallback by category if slug not found
const CATEGORY_FALLBACK: Record<string, BadgeConfig> = {
  Regular:          CONFIGS['regular-common'],
  Shiny:            CONFIGS['shiny-common'],
  Epic:             CONFIGS['epic'],
  'Special Edition':CONFIGS['special-edition'],
  'Special Epic':   CONFIGS['special-epic'],
  'Streak Epic':    CONFIGS['streak-epic'],
  Radiant:          CONFIGS['radiant'],
  Lyric:            CONFIGS['lyric'],
  Moment:           CONFIGS['moment'],
};

// Gradient backgrounds for gradient:true entries
const GRADIENT_STYLES: Record<string, string> = {
  'epic':          'linear-gradient(135deg, #451a03 0%, #4c0519 100%)',
  'epic-numbered': 'linear-gradient(135deg, #451a03 0%, #4c0519 100%)',
  'special-epic':  'linear-gradient(135deg, #4c0519 0%, #3f0f10 100%)',
  'streak-epic':   'linear-gradient(135deg, #431407 0%, #431407 100%)',
};

interface RarityBadgeProps {
  slug: string;
  name: string;
  category: string;
  size?: 'sm' | 'md';
  className?: string;
  /** Override the label (e.g. for variant label display) */
  labelOverride?: string;
}

export function RarityBadge({ slug, name, category, size = 'md', className, labelOverride }: RarityBadgeProps) {
  const config = CONFIGS[slug] || CATEGORY_FALLBACK[category] || CONFIGS['regular-common'];
  const label = labelOverride || config.label;

  const sizeClasses = size === 'sm'
    ? 'text-[10px] px-2 py-0.5 gap-1'
    : 'text-xs px-2.5 py-1 gap-1.5';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-semibold whitespace-nowrap select-none',
        sizeClasses,
        config.pill,
        className
      )}
      style={{
        ...(config.gradient ? { background: GRADIENT_STYLES[slug] || GRADIENT_STYLES['epic'] } : {}),
        ...(config.glow ? { boxShadow: `0 0 8px -2px ${config.glow}` } : {}),
      }}
    >
      {config.icon}
      {label}
    </span>
  );
}
