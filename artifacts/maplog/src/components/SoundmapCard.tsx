import React from 'react';
import type { MaplogCard } from '@/lib/types';
import { RarityBadge } from '@/components/RarityBadge';
import { useArtColor } from '@/lib/useArtColor';
import { cn } from '@/lib/utils';
import { Disc3 } from 'lucide-react';
import { presenceForCard, epicBorderKind } from '@/lib/cardTemplates';
import {
  MediaSlot, EpicPins, EpicCardOverlay, epicFrameStyle, EpicBorderWrap,
  MomentStars, FlavorBubble,
  LyricSubject, RadiantPatternOverlay, RadiantSpin,
} from '@/components/SpecialCardLayers';

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
    'epic-common':      '#22c55e',
    'epic-uncommon':    '#a855f7',
    'epic-rare':        '#f59e0b',
    'epic-unnumbered':  '#444444',
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
  onArtistClick?: () => void;
  /** Called when the user taps the play button inside the epic overlay. */
  onPlay?: () => void;
  /** Whether the song is currently playing — drives play/pause icon in the overlay. */
  isPlaying?: boolean;
  /**
   * Moment-specific: whether the video is muted. Defaults to true (always
   * silent in collection). CardView passes false when the user unmutes.
   */
  momentMuted?: boolean;
}

export function SoundmapCard({ card, title, artist, genre, className, size = 'md', onArtistClick, onPlay, isPlaying = false, momentMuted = true }: SoundmapCardProps) {
  const fallbackBorder = rarityFallbackColor(card.rarityType.slug);
  const borderColor = useArtColor(card.artworkUrl ?? null, fallbackBorder);

  const sizeClasses = {
    sm:   'w-24 rounded-xl',
    md:   'w-40 rounded-2xl',
    lg:   'w-64 rounded-2xl',
    hero: 'w-[280px] sm:w-[320px] landscape-compact:w-[160px] rounded-3xl',
  };

  // Epic cards use a narrower, taller slot so the video fills without
  // showing its own internal border content. Only epics use these.
  // Corner radii are larger than regular cards so the clip boundary sits well
  // outside the video card's inner border arc at every corner (math: need ≥24px
  // for md/lg and ≥32px for hero to clear the corner-arc inner edge after scale).
  const epicSizeClasses = {
    sm:   'w-24 rounded-xl',
    md:   'w-[140px] rounded-3xl',
    lg:   'w-[216px] rounded-3xl',
    hero: 'w-[248px] sm:w-[284px] landscape-compact:w-[140px] rounded-[32px]',
  };

  const artRadius = {
    sm: 'rounded-lg', md: 'rounded-xl', lg: 'rounded-xl', hero: 'rounded-2xl',
  };

  // Compute presence/isEpic first — used to pick the correct size maps below
  const presence = presenceForCard(card);
  const special  = presence !== 'regular';
  const bigCard  = size === 'lg' || size === 'hero';
  const isEpic   = presence === 'epic';
  const isRare   = card.rarityType.slug === 'regular-rare' || card.rarityType.slug === 'shiny-rare';
  const isShiny  = card.tags?.includes('shiny') || card.rarityType.slug.startsWith('shiny');

  const widthMap     = { sm: 96,  md: 160, lg: 256, hero: 300 };
  const epicWidthMap = { sm: 96,  md: 140, lg: 216, hero: 266 };
  const isMoment = presence === 'moment';

  // Moments share the same narrow/tall slot dimensions as epics so the video
  // fills the card face at the same aspect ratio.
  const cardWidth = ((isEpic || isMoment) ? epicWidthMap : widthMap)[size];

  const titleSize  = size === 'hero' ? 'text-xl'  : size === 'lg' ? 'text-base' : 'text-sm';
  const artistSize = size === 'hero' ? 'text-sm'  : 'text-xs';
  // sm cards never show info; epics render it invisible so card height matches regulars
  const showInfo = size !== 'sm';
  const artPad = size === 'sm' ? 'p-1.5' : 'p-2';

  // For typed epic playlists (common/uncommon/rare/unnumbered), use the new
  // neon border system. Legacy epic slugs fall back to the gold epicFrameStyle.
  const epicKind = presence === 'epic' ? epicBorderKind(card) : null;

  // Per-presence shell styling
  const shellStyle: React.CSSProperties = (() => {
    if (presence === 'epic') {
      // Typed epic playlists: dark shell — neon handled by CSS class or wrapper
      if (card.rarityType.slug === 'epic-common'
       || card.rarityType.slug === 'epic-uncommon'
       || card.rarityType.slug === 'epic-rare'
       || card.rarityType.slug === 'epic-unnumbered') {
        return { background: '#0a0a0f', border: 'none' };
      }
      // Legacy epics keep the gold gradient frame
      return epicFrameStyle(card);
    }
    return {
      border: `2px solid ${borderColor}`,
      transition: 'border-color 0.55s ease, box-shadow 0.55s ease, background-color 0.55s ease',
      ...(isRare ? {} : { boxShadow: `0 0 20px -4px ${borderColor}66, 0 0 0 1px ${borderColor}22` }),
      background: presence === 'moment'
        ? '#07070c'
        : `color-mix(in srgb, ${borderColor} 12%, #0a0a0f)`,
    };
  })();

  // Border for common/uncommon/rare epics is now handled by EpicBorderWrap
  // (no CSS class needed on the card itself)

  const cardBody = (
    <div
      className={cn(
        'relative flex flex-col overflow-hidden text-white card-effect',
        (isEpic || isMoment) ? epicSizeClasses[size] : sizeClasses[size],
        isRare && 'card-rare-glow',
        isMoment && 'card-moment-glow',
        className,
      )}
      style={shellStyle}
    >
      {/* Shiny foil overlay — covers art + frame */}
      {isShiny && <div className="foil-overlay" aria-hidden />}

      {/* Radiant: shimmer sweep + pattern overlay tinted with the art color */}
      {presence === 'radiant' && (
        <>
          <div className="radiant-shimmer" aria-hidden />
          <RadiantPatternOverlay patternId={card.patternId} color={borderColor} opacity={0.35} />
        </>
      )}

      {/* Epic: media + pins fill the full card absolutely (incl. padding & info area) */}
      {isEpic && <MediaSlot card={card} title={title} />}
      {isEpic && <EpicPins card={card} cardWidth={cardWidth} kind={epicKind ?? undefined} />}
      {isEpic && (epicKind === 'common' || epicKind === 'uncommon' || epicKind === 'rare') && (
        <EpicCardOverlay
          card={card}
          title={title}
          artist={artist}
          genre={genre}
          cardWidth={cardWidth}
          onArtistClick={onArtistClick}
          onPlay={onPlay}
          isPlaying={isPlaying}
        />
      )}

      {/* Moment: video fills the full card absolutely, same as epics */}
      {isMoment && <MediaSlot card={card} title={title} muted={momentMuted} />}

      {/* Art / media section */}
      <div className={cn(artPad, 'relative z-[2]')}>
        {(isEpic || isMoment) ? (
          /* Taller-than-square spacer — sets slot height; MediaSlot fills absolutely.
             Matches epic ratio so the video fills without showing internal borders. */
          <div className="aspect-[5/6]" />
        ) : (
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

            {card.variantLabel?.startsWith('#') ? (
              <div className="absolute top-1.5 right-1.5 z-10 bg-amber-400 text-black text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none shadow-md">
                {card.variantLabel}
              </div>
            ) : null}

            {presence === 'lyrics' && card.subjectText && showInfo && (
              <LyricSubject text={card.subjectText} cardWidth={cardWidth} />
            )}

            {presence === 'radiant' && (
              <RadiantPatternOverlay patternId={card.patternId} color={borderColor} opacity={0.55} />
            )}

            {card.variantLabel && STAMP_LABELS.has(card.variantLabel) && (
              <ArtStamp label={card.variantLabel} cardWidth={cardWidth} />
            )}
            </div>
        )}
      </div>

      {/* Moment overlay: badge floats at the bottom of the video face.
          No title — the video content provides it.
          px-4 gives equal left/right margin matching the video badge's edge position.
          pb-9 pushes the badge to roughly where the video's own badge sits. */}
      {isMoment && showInfo && (
        <div className="absolute bottom-0 inset-x-0 z-[4] px-1 pb-2 pt-20 bg-gradient-to-t from-black/80 via-black/35 to-transparent pointer-events-none">
          <div
            className="w-full flex items-center justify-center gap-2 px-4 py-1.5 rounded-full"
            style={{
              background: '#090909',
              border: '1px solid rgba(255,255,255,0.55)',
              boxShadow: '0 0 10px 1px rgba(255,255,255,0.28), inset 0 0 6px rgba(255,255,255,0.06)',
            }}
          >
            {/* Red gem — octagon faceted shape */}
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden>
              <polygon points="7,1 13,1 19,7 19,13 13,19 7,19 1,13 1,7" fill="#dc2626" stroke="#fca5a5" strokeWidth="0.8" />
              <polygon points="10,3 14,7 14,13 10,17 6,13 6,7" fill="#ef4444" opacity="0.6" />
              <line x1="10" y1="3" x2="10" y2="7" stroke="#fecaca" strokeWidth="0.8" opacity="0.8" />
            </svg>
            <span className="font-bold text-[13px] text-white leading-none tracking-wide">Moment</span>
          </div>
        </div>
      )}

      {/* Info section — epics & moments invisible (preserves card height); regular shows info */}
      {showInfo && (
        <div className={cn('relative z-[2] px-3 pt-2.5 pb-3 flex flex-col gap-1.5 items-center text-center', (isEpic || isMoment) && 'invisible pointer-events-none select-none')} aria-hidden={isEpic || isMoment}>
          <p className={cn('font-bold leading-tight truncate w-full', titleSize)}>{title}</p>
          {onArtistClick ? (
            <button
              type="button"
              className={cn('text-white/55 leading-tight truncate w-full text-center hover:text-white/80 active:opacity-70 transition-colors', artistSize)}
              onClick={e => { e.stopPropagation(); onArtistClick(); }}
            >
              {artist}
            </button>
          ) : (
            <p className={cn('text-white/55 leading-tight truncate w-full', artistSize)}>{artist}</p>
          )}
          {presence === 'lyrics' && card.flavorText && (
            <FlavorBubble text={card.flavorText} compact={size === 'md'} />
          )}
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

  // Numbered epics (common/uncommon/rare) get the rotating color border wrapper
  if (epicKind === 'common' || epicKind === 'uncommon' || epicKind === 'rare') {
    return <EpicBorderWrap kind={epicKind} size={size}>{cardBody}</EpicBorderWrap>;
  }

  // Radiant cards spin on drag (big sizes only); the back face shows the
  // Maplog logo under the same tinted pattern.
  if (presence === 'radiant' && bigCard) {
    const back = (
      <div
        className={cn('relative flex flex-col items-center justify-center overflow-hidden text-white aspect-auto h-full w-full', sizeClasses[size])}
        style={{
          border: `2px solid ${borderColor}`,
          background: `color-mix(in srgb, ${borderColor} 18%, #0a0a0f)`,
          minHeight: '100%',
        }}
      >
        <RadiantPatternOverlay patternId={card.patternId} color={borderColor} opacity={0.5} />
        <div className="radiant-shimmer" aria-hidden />
        <Disc3 className="w-16 h-16 mb-3" style={{ color: borderColor }} />
        <p className="font-display font-black text-2xl tracking-tight">Maplog</p>
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mt-1">Radiant</p>
      </div>
    );
    return <RadiantSpin enabled back={back}>{cardBody}</RadiantSpin>;
  }

  return cardBody;
}
