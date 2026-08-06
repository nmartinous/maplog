/** Canonical iPhone 14 Pro viewport dimensions used across all card-view mockups. */
export const VIEWPORT_W = 390;
export const VIEWPORT_H = 844;

/** Top bar (status bar + nav header) */
export const TOP_CHROME = 56;

/** Bottom chrome: MiniPlayer + MobileNav */
export const MINI_PLAYER = 64;
export const MOBILE_NAV = 54;
export const BOTTOM_CHROME = MINI_PLAYER + MOBILE_NAV; // 118

/** Card background zone height */
export const CARD_BG_H = VIEWPORT_H - TOP_CHROME - BOTTOM_CHROME; // 670

/** Default card slot: 75% of viewport width, 3:4.5 aspect ratio */
export const DEFAULT_SLOT_W_RATIO = 0.75;
export const CARD_ASPECT = 3 / 4.5;

export function slotDimensions(slotWidthPx: number) {
  const w = slotWidthPx;
  const h = w / CARD_ASPECT;
  return { w, h };
}
