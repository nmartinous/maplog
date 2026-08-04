import React from 'react';
import { CollectedCard } from '@workspace/api-client-react';
import { RarityBadge } from '@/components/RarityBadge';
import { useArtColor } from '@/lib/useArtColor';
import { cn } from '@/lib/utils';
import { Disc3, Play } from 'lucide-react';

// ── Variant label routing ─────────────────────────────────────────────────────

/** These variant labels replace the badge text (named Epic variants) */
const BADGE_LABEL_OVERRIDES = new Set(['Freshman']);

/** These variant labels render as art stamps; base rarity badge is unchanged */
const STAMP_LABELS = new Set([
  'Week 1', 'Day 1', 'April Fools', 'Halloween', 'Pridemap', 'Grammy', 'Lovers',
]);

// ── Modifier stamps on the art section ───────────────────────────────────────

function ArtStamp({ label, cardWidth }: { label: string; cardWidth: number }) {
  const stampSize = Math.max(32, cardWidth * 0.26);

  if (label === 'Week 1') {
    return (
      <div
        className="absolute bottom-0 left-0 bg-white/90 text-black font-black uppercase tracking-wider rounded-tr-lg leading-none z-10"
        style={{ fontSize: Math.max(7, cardWidth * 0.065), padding: '3px 7px 3px 5px' }}
      >
        WEEK 1
      </div>
    );
  }

  if (label === 'Day 1') {
    return (
      <svg
        className="absolute bottom-2 left-2 z-10 drop-shadow-md"
        width={stampSize} height={stampSize} viewBox="0 0 40 40"
        aria-label="Day 1"
      >
        <circle cx="20" cy="20" r="19" fill="#d4a017" />
        <circle cx="20" cy="20" r="19" fill="none" stroke="#8b6600" strokeWidth="0.8" />
        <circle cx="20" cy="20" r="14" fill="none" stroke="#8b6600" strokeWidth="0.6" strokeDasharray="2.5 2" />
        <text x="20" y="17.5" textAnchor="middle" fontSize="7" fontWeight="900" fill="#1a0800" fontFamily="sans-serif">DAY</text>
        <text x="20" y="26" textAnchor="middle" fontSize="10" fontWeight="900" fill="#1a0800" fontFamily="sans-serif">1</text>
        <path id="cpc-s" d="M20,20 m-16,0 a16,16 0 1,1 32,0 a16,16 0 1,1 -32,0" fill="none" />
        <text fontSize="4" fontWeight="700" fill="#1a0800" fontFamily="sans-serif" letterSpacing="1.2">
          <textPath href="#cpc-s" startOffset="5%">RELEASE EDITION · RELEASE EDITION ·</textPath>
        </text>
      </svg>
    );
  }

  if (label === 'April Fools') {
    return (
      <div
        className="absolute bottom-2 right-2 z-10 leading-none select-none drop-shadow-lg"
        style={{ fontSize: stampSize }} title="April Fools"
      >🤡</div>
    );
  }

  if (label === 'Halloween') {
    return (
      <div
        className="absolute bottom-2 right-2 z-10 leading-none select-none drop-shadow-lg"
        style={{ fontSize: stampSize }} title="Halloween"
      >🕷️</div>
    );
  }

  if (label === 'Pridemap') {
    return (
      <div className="absolute bottom-0 left-0 right-0 h-[5px] z-10 overflow-hidden">
        <div className="w-full h-full" style={{
          background: 'linear-gradient(90deg,#e40303 0%,#ff8c00 17%,#ffed00 33%,#008026 50%,#004dff 67%,#750787 83%,#e40303 100%)',
        }} />
      </div>
    );
  }

  if (label === 'Grammy') {
    return (
      <svg className="absolute bottom-2 right-2 z-10 drop-shadow-md"
        width={stampSize} height={stampSize} viewBox="0 0 40 40" aria-label="Grammy"
      >
        <circle cx="20" cy="20" r="19" fill="#c8a400" />
        <circle cx="20" cy="20" r="19" fill="none" stroke="#7a6000" strokeWidth="0.8" />
        <circle cx="20" cy="20" r="14" fill="none" stroke="#7a6000" strokeWidth="0.6" strokeDasharray="2.5 2" />
        <text x="20" y="18" textAnchor="middle" fontSize="6" fontWeight="900" fill="#1a0f00" fontFamily="sans-serif">GRAM</text>
        <text x="20" y="26" textAnchor="middle" fontSize="6" fontWeight="900" fill="#1a0f00" fontFamily="sans-serif">MY</text>
        <path id="gcp-s" d="M20,20 m-16,0 a16,16 0 1,1 32,0 a16,16 0 1,1 -32,0" fill="none" />
        <text fontSize="4" fontWeight="700" fill="#1a0f00" fontFamily="sans-serif" letterSpacing="1">
          <textPath href="#gcp-s" startOffset="5%">RECORDING ACADEMY · RECORDING ACADEMY ·</textPath>
        </text>
      </svg>
    );
  }

  if (label === 'Lovers') {
    return (
      <div
        className="absolute bottom-2 right-2 z-10 leading-none select-none drop-shadow-lg"
        style={{ fontSize: stampSize }} title="Lovers"
      >🩷</div>
    );
  }

  return null;
}

// ── Theme fallback border colors per rarity slug ──────────────────────────────

function rarityFallbackColor(slug: string): string {
  const map: Record<string, string> = {
    'regular-common':   '#166534',
    'regular-uncommon': '#7e22ce',
    'regular-rare':     '#c2410c',
    'shiny-common':     '#4ade80',
    'shiny-uncommon':   '#d946ef',
    'shiny-rare':       '#f97316',
    'epic':             '#b48400',
    'epic-numbered':    '#b48400',
    'special-edition':  '#be185d',
    'special-epic':     '#e11d48',
    'streak-epic':      '#ea580c',
    'radiant':          '#7c3aed',
    'lyric':            '#92400e',
    'moment':           '#991b1b',
  };
  return map[slug] || '#444444';
}

// ── Component ─────────────────────────────────────────────────────────────────

interface SoundmapCardProps {
  card: CollectedCard;
  title: string;
  artist: string;
  genre?: string | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  /** When provided, a play button appears in the info section */
  onPlay?: () => void;
}

export function SoundmapCard({
  card, title, artist, genre, className, size = 'md', onPlay,
}: SoundmapCardProps) {
  // Extract vibrant border color from artwork; fall back to rarity theme color
  const fallbackBorder = rarityFallbackColor(card.rarityType.slug);
  const borderColor = useArtColor(card.artworkUrl, fallbackBorder);

  const sizeClasses = {
    sm:   'w-24 h-36 rounded-xl',
    md:   'w-40 h-60 rounded-2xl',
    lg:   'w-64 h-96 rounded-2xl',
    hero: 'w-[280px] sm:w-[320px] aspect-[2/3] rounded-3xl',
  };

  const widthMap = { sm: 96, md: 160, lg: 256, hero: 300 };
  const cardWidth = widthMap[size];

  // Info-section font sizes
  const titleSize  = size === 'hero' ? 'text-xl'  : size === 'lg' ? 'text-base' : 'text-sm';
  const artistSize = size === 'hero' ? 'text-sm'  : 'text-xs';
  const showInfo   = size !== 'sm';

  return (
    <div
      className={cn(
        'relative flex flex-col overflow-hidden text-white card-effect',
        sizeClasses[size],
        className,
      )}
      style={{
        border: `2px solid ${borderColor}`,
        boxShadow: `0 0 20px -4px ${borderColor}66, 0 0 0 1px ${borderColor}22`,
        background: '#0d0d0d',
      }}
    >
      {/* ── Art section (top ~68%) ────────────────────────────────────────── */}
      <div className="relative flex-1 overflow-hidden bg-black">
        {card.artworkUrl ? (
          <img
            src={card.artworkUrl}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover"
            crossOrigin="anonymous"
          />
        ) : (
          /* Subtle dark gradient + ghost disc when no artwork */
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: `linear-gradient(160deg, ${borderColor}22 0%, #0d0d0d 100%)` }}
          >
            <Disc3
              className="opacity-[0.07]"
              style={{ width: '55%', height: '55%', color: borderColor }}
            />
          </div>
        )}

        {/* Numbered epic badge — top right of art */}
        {card.variantLabel?.startsWith('#') && (
          <div className="absolute top-2 right-2 z-10 bg-amber-400 text-black text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none shadow-md">
            {card.variantLabel}
          </div>
        )}

        {/* Modifier stamps inside the art section */}
        {card.variantLabel && STAMP_LABELS.has(card.variantLabel) && (
          <ArtStamp label={card.variantLabel} cardWidth={cardWidth} />
        )}
      </div>

      {/* ── Info section (bottom ~32%) ────────────────────────────────────── */}
      {showInfo && (
        <div
          className="shrink-0 px-3 pt-2.5 pb-3 flex flex-col gap-1.5"
          style={{ background: `color-mix(in srgb, ${borderColor} 22%, #07080f)` }}
        >
          {/* Title */}
          <p className={cn('font-bold leading-tight truncate', titleSize)}>
            {title}
          </p>

          {/* Artist + play button */}
          <div className="flex items-center justify-between gap-2">
            <p className={cn('text-white/55 leading-tight truncate flex-1', artistSize)}>
              {artist}
            </p>
            {onPlay && (
              <button
                onClick={e => { e.stopPropagation(); onPlay(); }}
                className="shrink-0 flex items-center justify-center text-white/40 hover:text-white/80 transition-colors active:scale-95"
                aria-label="Play"
              >
                <Play className={cn('fill-current', size === 'hero' ? 'w-4 h-4' : 'w-3.5 h-3.5')} />
              </button>
            )}
          </div>

          {/* Rarity badge + genre */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <RarityBadge
              slug={card.rarityType.slug}
              name={card.rarityType.name}
              category={card.rarityType.category}
              size="sm"
              labelOverride={
                card.variantLabel && BADGE_LABEL_OVERRIDES.has(card.variantLabel)
                  ? card.variantLabel
                  : undefined
              }
            />
            {genre && (
              <span className="text-[10px] font-semibold rounded-full bg-white/10 text-white/60 border border-white/10 px-2 py-0.5 leading-none flex items-center gap-1">
                <svg width="9" height="9" viewBox="0 0 9 9" fill="none" className="shrink-0">
                  <path d="M1 1.5h7M1 4.5h5M1 7.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                {genre}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
