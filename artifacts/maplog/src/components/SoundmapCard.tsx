import React from 'react';
import { CollectedCard } from '@workspace/api-client-react';
import { RarityBadge } from '@/components/RarityBadge';
import { cn } from '@/lib/utils';
import { Disc3 } from 'lucide-react';

// Variant Epic label overrides: badge text changes to the variant name
// (these are epic-tier variants — Freshman shows "Freshman" in the badge, etc.)
const BADGE_LABEL_OVERRIDES = new Set([
  'Freshman',
]);

// Variant Regular stamps: overlay on the card art, base rarity badge unchanged
// Includes event modifiers (Week 1, Day 1, April Fools, Halloween),
// variant regulars (Grammy, Lovers), and Epic visual modifiers (Pridemap)
const STAMP_LABELS = new Set([
  'Week 1', 'Day 1', 'April Fools', 'Halloween', 'Pridemap', 'Grammy', 'Lovers',
]);

/** Modifier stamp rendered directly on the card face */
function CardModifierStamp({ label, cardWidth }: { label: string; cardWidth: number }) {
  const stampSize = Math.max(32, cardWidth * 0.28);

  if (label === 'Week 1') {
    return (
      <div
        className="absolute bottom-0 left-0 bg-white/90 text-black font-black uppercase tracking-wider rounded-tr-lg rounded-bl-2xl leading-none z-20"
        style={{ fontSize: Math.max(7, cardWidth * 0.07), padding: '3px 7px 3px 5px' }}
      >
        WEEK 1
      </div>
    );
  }

  if (label === 'Day 1') {
    return (
      <svg
        className="absolute bottom-2 left-2 z-20 drop-shadow-md"
        width={stampSize} height={stampSize}
        viewBox="0 0 40 40"
        aria-label="Day 1"
      >
        <circle cx="20" cy="20" r="19" fill="#d4a017" />
        <circle cx="20" cy="20" r="19" fill="none" stroke="#8b6600" strokeWidth="0.8" />
        <circle cx="20" cy="20" r="14" fill="none" stroke="#8b6600" strokeWidth="0.6" strokeDasharray="2.5 2" />
        <text x="20" y="17.5" textAnchor="middle" fontSize="7" fontWeight="900" fill="#1a0800" fontFamily="sans-serif">DAY</text>
        <text x="20" y="26" textAnchor="middle" fontSize="10" fontWeight="900" fill="#1a0800" fontFamily="sans-serif">1</text>
        <path id="cpc" d="M20,20 m-16,0 a16,16 0 1,1 32,0 a16,16 0 1,1 -32,0" fill="none" />
        <text fontSize="4" fontWeight="700" fill="#1a0800" fontFamily="sans-serif" letterSpacing="1.2">
          <textPath href="#cpc" startOffset="5%">RELEASE EDITION · RELEASE EDITION ·</textPath>
        </text>
      </svg>
    );
  }

  if (label === 'April Fools') {
    return (
      <div
        className="absolute bottom-2 right-2 z-20 leading-none select-none drop-shadow-lg"
        style={{ fontSize: stampSize }}
        title="April Fools"
      >
        🤡
      </div>
    );
  }

  if (label === 'Halloween') {
    return (
      <div
        className="absolute bottom-2 right-2 z-20 leading-none select-none drop-shadow-lg"
        style={{ fontSize: stampSize }}
        title="Halloween"
      >
        🕷️
      </div>
    );
  }

  if (label === 'Pridemap') {
    return (
      <div className="absolute bottom-0 left-0 right-0 h-[6px] z-20 overflow-hidden rounded-b-[inherit]">
        <div
          className="w-full h-full"
          style={{
            background: 'linear-gradient(90deg, #e40303 0%, #ff8c00 17%, #ffed00 33%, #008026 50%, #004dff 67%, #750787 83%, #e40303 100%)',
          }}
        />
      </div>
    );
  }

  if (label === 'Grammy') {
    return (
      <svg
        className="absolute bottom-2 right-2 z-20 drop-shadow-md"
        width={stampSize} height={stampSize}
        viewBox="0 0 40 40"
        aria-label="Grammy"
      >
        <circle cx="20" cy="20" r="19" fill="#c8a400" />
        <circle cx="20" cy="20" r="19" fill="none" stroke="#7a6000" strokeWidth="0.8" />
        <circle cx="20" cy="20" r="14" fill="none" stroke="#7a6000" strokeWidth="0.6" strokeDasharray="2.5 2" />
        <text x="20" y="18" textAnchor="middle" fontSize="6" fontWeight="900" fill="#1a0f00" fontFamily="sans-serif">GRAM</text>
        <text x="20" y="26" textAnchor="middle" fontSize="6" fontWeight="900" fill="#1a0f00" fontFamily="sans-serif">MY</text>
        <path id="gcp" d="M20,20 m-16,0 a16,16 0 1,1 32,0 a16,16 0 1,1 -32,0" fill="none" />
        <text fontSize="4" fontWeight="700" fill="#1a0f00" fontFamily="sans-serif" letterSpacing="1">
          <textPath href="#gcp" startOffset="5%">RECORDING ACADEMY · RECORDING ACADEMY ·</textPath>
        </text>
      </svg>
    );
  }

  if (label === 'Lovers') {
    return (
      <div
        className="absolute bottom-2 right-2 z-20 leading-none select-none drop-shadow-lg"
        style={{ fontSize: stampSize }}
        title="Lovers"
      >
        🩷
      </div>
    );
  }

  return null;
}

interface SoundmapCardProps {
  card: CollectedCard;
  title: string;
  artist: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'hero';
}

function parseThemeConfig(config: any) {
  return {
    borderColor: config?.borderColor || '#444',
    glowColor: config?.glowColor || 'rgba(0,0,0,0)',
    hasShimmer: config?.hasShimmer === true,
    isPrismatic: config?.isPrismatic === true,
  };
}

// Returns a CSS background string for the card body based on rarity
function cardBackground(slug: string, borderColor: string): string {
  const map: Record<string, string> = {
    'regular-common':   'linear-gradient(160deg, #0d1f0d 0%, #0a120a 100%)',
    'regular-uncommon': 'linear-gradient(160deg, #1a0f2e 0%, #0f0a1a 100%)',
    'regular-rare':     'linear-gradient(160deg, #1f1200 0%, #120900 100%)',
    'shiny-common':     'linear-gradient(160deg, #1a0d2e 0%, #0a0d1f 100%)',
    'shiny-uncommon':   'linear-gradient(160deg, #130d2e 0%, #0a0a1f 100%)',
    'shiny-rare':       'linear-gradient(160deg, #0d0f2e 0%, #07071a 100%)',
    'epic':             'linear-gradient(160deg, #1f1000 0%, #1f0010 100%)',
    'epic-numbered':    'linear-gradient(160deg, #1f1000 0%, #1f0010 100%)',
    'special-edition':  'linear-gradient(160deg, #2e0d1a 0%, #1a0010 100%)',
    'special-epic':     'linear-gradient(160deg, #2e0505 0%, #1a000f 100%)',
    'streak-epic':      'linear-gradient(160deg, #2e1000 0%, #1f0a00 100%)',
    'radiant':          'linear-gradient(160deg, #0f0f14 0%, #0a0a10 100%)',
    'lyric':            'linear-gradient(160deg, #000f1f 0%, #001428 100%)',
    'moment':           'linear-gradient(160deg, #1a0f2e 0%, #0a0014 100%)',
  };
  return map[slug] || `linear-gradient(160deg, #111 0%, #090909 100%)`;
}

export function SoundmapCard({ card, title, artist, className, size = 'md' }: SoundmapCardProps) {
  const theme = parseThemeConfig(card.rarityType.themeConfig);

  const sizeClasses = {
    sm:   'w-24 h-36 rounded-xl',
    md:   'w-40 h-60 rounded-2xl',
    lg:   'w-64 h-96 rounded-2xl',
    hero: 'w-[280px] sm:w-[320px] aspect-[2/3] rounded-3xl',
  };

  return (
    <div
      className={cn(
        'card-effect relative flex flex-col justify-end overflow-hidden text-white',
        sizeClasses[size],
        className
      )}
      style={{
        background: cardBackground(card.rarityType.slug, theme.borderColor),
        border: `2px solid ${theme.borderColor}`,
        boxShadow: `0 0 24px -6px ${theme.glowColor}, 0 0 0 1px ${theme.borderColor}22`,
      }}
    >
      {/* Background artwork */}
      {card.artworkUrl && (
        <img
          src={card.artworkUrl}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover z-0 opacity-60 mix-blend-luminosity"
        />
      )}

      {/* Shimmer overlay for shiny / epic types */}
      {theme.hasShimmer && (
        <div className="absolute inset-0 z-10 shimmer-bg pointer-events-none mix-blend-soft-light opacity-60" />
      )}

      {/* Prismatic overlay for Radiant */}
      {theme.isPrismatic && (
        <div
          className="absolute inset-0 z-10 pointer-events-none opacity-40"
          style={{
            background: 'linear-gradient(135deg, #ff006688 0%, #ffff0088 25%, #00ff8888 50%, #0088ff88 75%, #8800ff88 100%)',
            backgroundSize: '400% 400%',
            animation: 'shimmer 3s linear infinite',
          }}
        />
      )}

      {/* Rarity badge — top left */}
      <div className="absolute top-2.5 left-2.5 z-20">
        <RarityBadge
          slug={card.rarityType.slug}
          name={card.rarityType.name}
          category={card.rarityType.category}
          size={size === 'sm' ? 'sm' : 'md'}
          // Named variants (Grammy, Freshman, Lovers) override the badge label.
          // Stamp modifiers (Week 1, Day 1, April Fools, Halloween, Pridemap) and
          // numbered variants (#031) are handled separately — badge stays as rarity name.
          labelOverride={
            card.variantLabel && BADGE_LABEL_OVERRIDES.has(card.variantLabel)
              ? card.variantLabel
              : undefined
          }
        />
      </div>

      {/* Numbered epic — top right amber pill */}
      {card.variantLabel?.startsWith('#') && (
        <div className="absolute top-2.5 right-2.5 z-20 bg-amber-400 text-black text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none">
          {card.variantLabel}
        </div>
      )}

      {/* Modifier stamp — corner sticker for Week 1, Day 1, April Fools, Halloween, Pridemap */}
      {card.variantLabel && STAMP_LABELS.has(card.variantLabel) && (() => {
        // Map size name → approximate card pixel width for stamp sizing
        const widthMap = { sm: 96, md: 160, lg: 256, hero: 300 };
        return <CardModifierStamp label={card.variantLabel} cardWidth={widthMap[size]} />;
      })()}

      {/* Fallback center icon when no artwork */}
      {!card.artworkUrl && (
        <div className="absolute inset-0 z-0 flex items-center justify-center">
          <Disc3
            className="opacity-[0.06]"
            style={{
              width: '55%',
              height: '55%',
              color: theme.borderColor,
            }}
          />
        </div>
      )}

      {/* Bottom title/artist overlay */}
      <div
        className="relative z-20 px-3 pb-3 pt-12"
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.6) 60%, transparent 100%)',
        }}
      >
        {size !== 'sm' && (
          <>
            <p className={cn(
              'font-bold truncate leading-tight mb-0.5',
              size === 'hero' ? 'text-xl' : size === 'lg' ? 'text-base' : 'text-sm'
            )}>
              {title}
            </p>
            <p className={cn(
              'text-white/60 truncate leading-tight',
              size === 'hero' ? 'text-sm' : 'text-xs'
            )}>
              {artist}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
