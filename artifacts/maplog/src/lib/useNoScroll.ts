import { useEffect } from 'react';

/**
 * Locks scroll for the lifetime of the calling component.
 *
 * Sets overflow:hidden on <html> (not body) so Radix UI portals
 * (dropdowns, dialogs) can still calculate their fixed positions correctly.
 * The page must already be height-constrained (h-dvh etc.) — this just
 * prevents any accidental overflow from scrolling.
 */
export function useNoScroll() {
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prev;
    };
  }, []);
}
