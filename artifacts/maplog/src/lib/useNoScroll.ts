import { useEffect } from 'react';

/**
 * Locks body scroll for the lifetime of the calling component.
 * Works on iOS Safari / PWA by also setting position:fixed.
 */
export function useNoScroll() {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevPosition = document.body.style.position;
    const prevWidth    = document.body.style.width;
    const prevHeight   = document.body.style.height;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width    = '100%';
    document.body.style.height   = '100%';

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.position = prevPosition;
      document.body.style.width    = prevWidth;
      document.body.style.height   = prevHeight;
    };
  }, []);
}
