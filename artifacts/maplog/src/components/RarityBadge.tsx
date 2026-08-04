import React from 'react';
import { cn } from '@/lib/utils';

// ─── SVG Icon Components ────────────────────────────────────────────────────

/** Faceted hexagon gem — Common / Shiny base */
const CrystalGem = ({ color }: { color: string }) => (
  <svg width="10" height="11" viewBox="0 0 10 11" fill="none" className="shrink-0" aria-hidden>
    <polygon points="5,0.5 9,3 9,7.5 5,10.5 1,7.5 1,3" fill={color} />
    <polygon points="5,0.5 9,3 5,5.5 1,3" fill="white" fillOpacity="0.28" />
  </svg>
);

/** Three-petal flower / asterisk — Uncommon */
const FlowerStar = ({ color }: { color: string }) => (
  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="shrink-0" aria-hidden>
    <ellipse cx="5.5" cy="5.5" rx="1.6" ry="4.6" fill={color} />
    <ellipse cx="5.5" cy="5.5" rx="1.6" ry="4.6" fill={color} transform="rotate(60 5.5 5.5)" />
    <ellipse cx="5.5" cy="5.5" rx="1.6" ry="4.6" fill={color} transform="rotate(120 5.5 5.5)" />
  </svg>
);

/** Pixel/mosaic gem face — Rare */
const PixelGem = ({ color }: { color: string }) => (
  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="shrink-0" aria-hidden>
    <rect x="0.5" y="0.5" width="10" height="10" rx="1.5" fill={color} fillOpacity="0.18" stroke={color} strokeWidth="0.8" />
    {/* eyes */}
    <rect x="2" y="2.5" width="2.5" height="2.5" rx="0.5" fill={color} />
    <rect x="6.5" y="2.5" width="2.5" height="2.5" rx="0.5" fill={color} />
    {/* mouth */}
    <rect x="2" y="7" width="7" height="1.5" rx="0.5" fill={color} />
  </svg>
);

/** Diamond — Epic variants */
const DiamondIcon = ({ color }: { color: string }) => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0" aria-hidden>
    <polygon points="5,0.5 9.5,5 5,9.5 0.5,5" fill={color} />
    <polygon points="5,0.5 9.5,5 5,4.2" fill="white" fillOpacity="0.22" />
  </svg>
);

/** 4-pointed sparkle — Radiant */
const SparkleIcon = ({ color }: { color: string }) => (
  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="shrink-0" aria-hidden>
    <polygon
      points="5.5,0 6.9,4.1 11,5.5 6.9,6.9 5.5,11 4.1,6.9 0,5.5 4.1,4.1"
      fill={color}
    />
  </svg>
);

/** Heart — Moment */
const HeartIcon = ({ color }: { color: string }) => (
  <svg width="11" height="10" viewBox="0 0 11 10" fill="none" className="shrink-0" aria-hidden>
    <path
      d="M5.5 8.8C5.5 8.8 0.8 5.6 0.8 3C0.8 1.5 1.9 0.8 3 0.8C4.1 0.8 4.9 1.4 5.5 2.7C6.1 1.4 6.9 0.8 8 0.8C9.1 0.8 10.2 1.5 10.2 3C10.2 5.6 5.5 8.8 5.5 8.8Z"
      fill={color}
    />
  </svg>
);

/** Speech-bubble with music lines — Lyrics */
const LyricsIcon = ({ color }: { color: string }) => (
  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="shrink-0" aria-hidden>
    <path
      d="M1.5 1h8a0.8 0.8 0 01.8.8v5.4a0.8 0.8 0 01-.8.8H6L4 10V8H1.5a0.8 0.8 0 01-.8-.8V1.8A0.8 0.8 0 011.5 1z"
      fill={color}
      fillOpacity="0.9"
    />
    <line x1="3" y1="3.5" x2="8" y2="3.5" stroke="white" strokeWidth="0.9" strokeLinecap="round" />
    <line x1="3" y1="5.5" x2="6.5" y2="5.5" stroke="white" strokeWidth="0.9" strokeLinecap="round" />
  </svg>
);

// ─── Config ─────────────────────────────────────────────────────────────────

interface BadgeConfig {
  icon: React.ReactNode;
  /** Tailwind classes for bg + text; border handled separately */
  pill: string;
  label: string;
  /** hex/rgba border color (static, overridden by shiny animation) */
  borderColor: string;
  /** optional box-shadow glow */
  glow?: string;
  /** use inline gradient background instead of tailwind bg */
  gradient?: string;
  /** rainbow border animation */
  shiny?: boolean;
}

const CONFIGS: Record<string, BadgeConfig> = {
  // ── Base rarities ──────────────────────────────────────────────────────────
  'regular-common': {
    icon: <CrystalGem color="#4ade80" />,
    pill: 'bg-[#04120a]/95 text-green-400',
    label: 'Common',
    borderColor: '#166534aa',
    glow: '#16653440',
  },
  'regular-uncommon': {
    icon: <FlowerStar color="#d946ef" />,
    pill: 'bg-[#0e0520]/95 text-purple-300',
    label: 'Uncommon',
    borderColor: '#7e22ceaa',
    glow: '#7e22ce38',
  },
  'regular-rare': {
    icon: <PixelGem color="#f97316" />,
    pill: 'bg-[#160800]/95 text-orange-400',
    label: 'RARE',
    borderColor: '#c2410caa',
    glow: '#c2410c40',
  },

  // ── Shiny modifier (same look as base, animated rainbow border) ────────────
  'shiny-common': {
    icon: <CrystalGem color="#4ade80" />,
    pill: 'bg-[#04120a]/95 text-green-400',
    label: 'Common',
    borderColor: '#4ade80',
    shiny: true,
  },
  'shiny-uncommon': {
    icon: <FlowerStar color="#d946ef" />,
    pill: 'bg-[#0e0520]/95 text-purple-300',
    label: 'Uncommon',
    borderColor: '#d946ef',
    shiny: true,
  },
  'shiny-rare': {
    icon: <PixelGem color="#f97316" />,
    pill: 'bg-[#160800]/95 text-orange-400',
    label: 'RARE',
    borderColor: '#f97316',
    shiny: true,
  },

  // ── Epic family ────────────────────────────────────────────────────────────
  'epic': {
    icon: <DiamondIcon color="white" />,
    pill: 'text-amber-50',
    label: 'Epic',
    borderColor: '#b4840055',
    gradient: 'linear-gradient(90deg, #6b5800 0%, #4a2a00 100%)',
    glow: '#b4840050',
  },
  'epic-numbered': {
    icon: <DiamondIcon color="white" />,
    pill: 'text-amber-50',
    label: 'Epic',
    borderColor: '#b4840055',
    gradient: 'linear-gradient(90deg, #6b5800 0%, #4a2a00 100%)',
    glow: '#b4840050',
  },

  // ── Special / retired epics (kept for existing data) ───────────────────────
  'special-edition': {
    icon: <FlowerStar color="#f472b6" />,
    pill: 'bg-[#200616]/95 text-pink-300',
    label: 'Special Ed.',
    borderColor: '#be185daa',
    glow: '#be185d40',
  },
  'special-epic': {
    icon: <DiamondIcon color="#fb7185" />,
    pill: 'text-rose-100',
    label: 'Special Epic',
    borderColor: '#e11d4855',
    gradient: 'linear-gradient(90deg, #4c0519 0%, #3b0010 100%)',
    glow: '#e11d4850',
  },
  'streak-epic': {
    icon: <DiamondIcon color="#fdba74" />,
    pill: 'text-orange-100',
    label: 'Streak Epic',
    borderColor: '#ea580c55',
    gradient: 'linear-gradient(90deg, #431407 0%, #2b0e00 100%)',
    glow: '#ea580c50',
  },

  // ── Premium rarities ───────────────────────────────────────────────────────
  'radiant': {
    icon: <SparkleIcon color="#e2d9f3" />,
    pill: 'bg-[#0a0614]/95 text-violet-100',
    label: 'Radiant',
    borderColor: '#7c3aed66',
    glow: '#7c3aed30',
  },
  'moment': {
    icon: <HeartIcon color="#ef4444" />,
    pill: 'bg-[#060606]/95 text-white',
    label: 'Moment',
    borderColor: '#7f1d1d88',
    glow: '#ef444420',
  },
  'lyric': {
    icon: <LyricsIcon color="#fbbf24" />,
    pill: 'bg-[#0d0901]/95 text-amber-200/90',
    label: 'Lyrics',
    borderColor: '#92400eaa',
    glow: '#92400e30',
  },
};

// Fallback by category
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

// ─── Component ───────────────────────────────────────────────────────────────

interface RarityBadgeProps {
  slug: string;
  name: string;
  category: string;
  size?: 'sm' | 'md';
  className?: string;
  /** Override the label — only for named variants (Grammy, Freshman, Lovers, etc.) */
  labelOverride?: string;
}

export function RarityBadge({
  slug,
  name,
  category,
  size = 'md',
  className,
  labelOverride,
}: RarityBadgeProps) {
  const config = CONFIGS[slug] || CATEGORY_FALLBACK[category] || CONFIGS['regular-common'];
  const label = labelOverride || config.label;

  const sizeClasses =
    size === 'sm'
      ? 'text-[10px] px-2 py-0.5 gap-1'
      : 'text-xs px-2.5 py-1 gap-1.5';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-semibold whitespace-nowrap select-none',
        sizeClasses,
        config.pill,
        config.shiny ? 'badge-shiny' : '',
        className
      )}
      style={{
        ...(config.gradient ? { background: config.gradient } : {}),
        ...(!config.shiny
          ? {
              border: `1.5px solid ${config.borderColor}`,
              ...(config.glow ? { boxShadow: `0 0 8px -2px ${config.glow}` } : {}),
            }
          : {}),
      }}
    >
      {config.icon}
      {label}
    </span>
  );
}
