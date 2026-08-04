import React from 'react';
import { CollectedCard } from '@workspace/api-client-react';
import { RarityBadge } from '@/components/RarityBadge';
import { cn } from '@/lib/utils';
import { Disc3 } from 'lucide-react';

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
          // Only use variantLabel as badge text for named variants (Grammy, Freshman, etc.)
          // Numbered variants (#031) show as a separate overlay, not in the badge
          labelOverride={
            card.variantLabel && !card.variantLabel.startsWith('#')
              ? card.variantLabel
              : undefined
          }
        />
      </div>

      {/* Number overlay — top right for numbered epics */}
      {card.variantLabel && card.variantLabel.startsWith('#') && (
        <div className="absolute top-2.5 right-2.5 z-20 bg-amber-400 text-black text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none">
          {card.variantLabel}
        </div>
      )}

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
