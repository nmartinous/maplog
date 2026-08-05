import React from 'react';
import type { MaplogCard } from '@/lib/types';
import { RarityBadge } from '@/components/RarityBadge';
import { useArtColor } from '@/lib/useArtColor';
import { cn } from '@/lib/utils';
import { Disc3 } from 'lucide-react';

// ── Variant label routing ──────────────────────────────────────────────────────

const BADGE_LABEL_OVERRIDES = new Set(['Freshman']);

const STAMP_LABELS = new Set([
  'Week 1', 'Day 1', 'April Fools', 'Halloween', 'Pridemap', 'Grammy', 'Lovers',
]);

// ── Modifier stamps on the art section ───────────────────────────────────────

function ArtStamp({ label, cardWidth }: { label: string; cardWidth: number }) {
  const stampSize = Math.max(32, cardWidth * 0.26);

  if (label === 'Week 1') return (
    <div className="absolute bottom-0 left-0 bg-white/90 text-black font-black uppercase tracking-wider rounded-tr-lg leading-none z-10"
      style={{ fontSize: Math.max(7, cardWidth * 0.065), padding: '3px 7px 3px 5px' }}>
      WEEK 1
    </div>
  );
  if (label === 'Day 1') return (
    <svg className="absolute bottom-2 left-2 z-10 drop-shadow-md"
      width={stampSize} height={stampSize} viewBox="0 0 40 40" aria-label="Day 1">
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
  if (label === 'April Fools') return (
    <div className="absolute bottom-2 right-2 z-10 leading-none select-none drop-shadow-lg"
      style={{ fontSize: stampSize }} title="April Fools">🤡</div>
  );
  if (label === 'Halloween') return (
    <div className="absolute bottom-2 right-2 z-10 leading-none select-none drop-shadow-lg"
      style={{ fontSize: stampSize }} title="Halloween">🕷️</div>
  );
  if (label === 'Pridemap') return (
    <div className="absolute bottom-0 left-0 right-0 h-[5px] z-10 overflow-hidden">
      <div className="w-full h-full" style={{
        background: 'linear-gradient(90deg,#e40303 0%,#ff8c00 17%,#ffed00 33%,#008026 50%,#004dff 67%,#750787 83%,#e40303 100%)',
      }} />
    </div>
  );
  if (label === 'Grammy') return (
    <svg className="absolute bottom-2 right-2 z-10 drop-shadow-md"
      width={stampSize} height={stampSize} viewBox="0 0 40 40" aria-label="Grammy">
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
  if (label === 'Lovers') return (
    <div className="absolute bottom-2 right-2 z-10 leading-none select-none drop-shadow-lg"
      style={{ fontSize: stampSize }} title="Lovers">🩷</div>
  );
  return null;
}

// ── Rarity fallback border colors ─────────────────────────────────────────────

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

// ── Component ──────────────────────────────────────────────────────────────────

interface SoundmapCardProps {
  card: MaplogCard;
  title: string;
  artist: string;
  genre?: string | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'hero';
}

export function SoundmapCard({ card, title, artist, genre, className, size = 'md' }: SoundmapCardProps) {
  const fallbackBorder = rarityFallbackColor(card.rarityType.slug);
  const borderColor = useArtColor(card.artworkUrl ?? null, fallbackBorder);

  const sizeClasses = {
    sm:   'w-24 rounded-xl',
    md:   'w-40 rounded-2xl',
    lg:   'w-64 rounded-2xl',
    hero: 'w-[280px] sm:w-[320px] landscape-compact:w-[160px] rounded-3xl',
  };

  const artRadius = {
    sm: 'rounded-lg', md: 'rounded-xl', lg: 'rounded-xl', hero: 'rounded-2xl',
  };

  const artPad    = size === 'sm' ? 'p-1.5' : 'p-2';
  const widthMap  = { sm: 96, md: 160, lg: 256, hero: 300 };
  const cardWidth = widthMap[size];

  const titleSize  = size === 'hero' ? 'text-xl'  : size === 'lg' ? 'text-base' : 'text-sm';
  const artistSize = size === 'hero' ? 'text-sm'  : 'text-xs';
  const showInfo   = size !== 'sm';

  const isRare = card.rarityType.slug === 'regular-rare' || card.rarityType.slug === 'shiny-rare';

  return (
    <div
      className={cn(
        'relative flex flex-col overflow-hidden text-white card-effect',
        sizeClasses[size],
        isRare && 'card-rare-glow',
        className,
      )}
      style={{
        border: `2px solid ${borderColor}`,
        // Smooth color transition when vibrant color resolves from artwork extraction
        transition: 'border-color 0.55s ease, box-shadow 0.55s ease, background-color 0.55s ease',
        ...(isRare ? {} : { boxShadow: `0 0 20px -4px ${borderColor}66, 0 0 0 1px ${borderColor}22` }),
        background: `color-mix(in srgb, ${borderColor} 12%, #0a0a0f)`,
      }}
    >
      {/* Art section */}
      <div className={artPad}>
        <div className={cn('relative aspect-square overflow-hidden', artRadius[size])}>
          {card.artworkUrl ? (
            <img
              src={card.artworkUrl}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover"
              crossOrigin="anonymous"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center"
              style={{ background: `linear-gradient(160deg, ${borderColor}22 0%, #0d0d0d 100%)` }}>
              <Disc3 className="opacity-[0.07]" style={{ width: '55%', height: '55%', color: borderColor }} />
            </div>
          )}

          {card.variantLabel?.startsWith('#') && (
            <div className="absolute top-1.5 right-1.5 z-10 bg-amber-400 text-black text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none shadow-md">
              {card.variantLabel}
            </div>
          )}

          {card.variantLabel && STAMP_LABELS.has(card.variantLabel) && (
            <ArtStamp label={card.variantLabel} cardWidth={cardWidth} />
          )}
        </div>
      </div>

      {/* Info section */}
      {showInfo && (
        <div className="px-3 pt-2.5 pb-3 flex flex-col gap-1.5 items-center text-center">
          <p className={cn('font-bold leading-tight truncate w-full', titleSize)}>{title}</p>
          <p className={cn('text-white/55 leading-tight truncate w-full', artistSize)}>{artist}</p>
          <div className="flex items-center justify-center gap-1.5 flex-wrap mt-0.5">
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
