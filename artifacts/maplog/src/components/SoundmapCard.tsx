import React from 'react';
import { CollectedCard } from '@workspace/api-client-react';
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
    backgroundEffect: config?.backgroundEffect || 'linear-gradient(135deg, #222 0%, #111 100%)',
    badgeLabel: config?.badgeLabel || '',
    hasShimmer: config?.hasShimmer === true,
    hasParticles: config?.hasParticles === true,
  };
}

export function SoundmapCard({ card, title, artist, className, size = 'md' }: SoundmapCardProps) {
  const theme = parseThemeConfig(card.rarityType.themeConfig);
  
  const sizeClasses = {
    sm: 'w-24 h-36 rounded-md',
    md: 'w-40 h-60 rounded-lg',
    lg: 'w-64 h-96 rounded-xl',
    hero: 'w-[280px] sm:w-[320px] aspect-[2/3] rounded-2xl',
  };

  const textClasses = {
    sm: 'text-[10px] leading-tight',
    md: 'text-xs leading-tight',
    lg: 'text-sm leading-tight',
    hero: 'text-base leading-tight',
  };

  const titleClasses = {
    sm: 'text-xs font-bold truncate',
    md: 'text-sm font-bold truncate',
    lg: 'text-lg font-bold truncate',
    hero: 'text-2xl font-bold truncate',
  };

  const badgeSizeClasses = {
    sm: 'text-[8px] px-1 py-0.5',
    md: 'text-[10px] px-1.5 py-0.5',
    lg: 'text-xs px-2 py-1',
    hero: 'text-sm px-3 py-1',
  };

  const badgeLabel = card.variantLabel || theme.badgeLabel || card.rarityType.name.toUpperCase();

  return (
    <div
      className={cn(
        'card-effect relative flex flex-col justify-end p-3 sm:p-4 text-white overflow-hidden',
        sizeClasses[size],
        className
      )}
      style={{
        background: theme.backgroundEffect,
        border: `2px solid ${theme.borderColor}`,
        boxShadow: `0 0 20px -5px ${theme.glowColor}`,
      }}
    >
      {/* Background artwork or gradient */}
      {card.artworkUrl ? (
        <img 
          src={card.artworkUrl} 
          alt={title} 
          className="absolute inset-0 w-full h-full object-cover z-0 opacity-80 mix-blend-overlay"
        />
      ) : (
        <div className="absolute inset-0 z-0 flex items-center justify-center opacity-10">
          <Disc3 className="w-1/2 h-1/2" />
        </div>
      )}

      {/* Shimmer effect for shiny cards */}
      {theme.hasShimmer && (
        <div className="absolute inset-0 z-10 shimmer-bg pointer-events-none mix-blend-overlay" />
      )}

      {/* Badge Top Left */}
      <div className="absolute top-2 sm:top-3 left-2 sm:left-3 z-20">
        <div
          className={cn(
            "font-black tracking-widest uppercase rounded bg-black/60 backdrop-blur-md border border-white/20",
            badgeSizeClasses[size]
          )}
          style={{
            color: theme.borderColor,
            textShadow: `0 0 10px ${theme.glowColor}`
          }}
        >
          {badgeLabel}
        </div>
      </div>

      {/* Bottom info area */}
      <div className="relative z-20 mt-auto pt-10 bg-gradient-to-t from-black/90 via-black/40 to-transparent -mx-3 -mb-3 px-3 pb-3 sm:-mx-4 sm:-mb-4 sm:px-4 sm:pb-4">
        <div className={cn(titleClasses[size], "mb-0.5")}>{title}</div>
        <div className={cn(textClasses[size], "text-white/70 font-medium truncate")}>{artist}</div>
      </div>
    </div>
  );
}
