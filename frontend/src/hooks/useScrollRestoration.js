/**
 * useScrollRestoration — Lightweight scroll position save/restore hook.
 *
 * Usage: Call inside any page component to preserve scroll position when
 * the user navigates away and returns.
 *
 * How it works:
 *  - On unmount: saves window.scrollY to sessionStorage keyed by route pathname
 *  - On mount: restores the saved scroll position after a brief paint delay
 *
 * This supplements React Router's built-in scroll-to-top behaviour, giving
 * users the "back button feels instant" experience.
 */
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export function useScrollRestoration() {
  const { pathname, key } = useLocation();
  const storageKey = `helpu_scroll_${pathname}`;
  const isMountedRef = useRef(false);

  useEffect(() => {
    if (isMountedRef.current) return; // already restored this mount
    isMountedRef.current = true;

    // Restore saved scroll position (if any) after the page has painted
    const saved = sessionStorage.getItem(storageKey);
    if (saved != null) {
      const y = parseInt(saved, 10);
      if (!isNaN(y) && y > 0) {
        // Use requestAnimationFrame to ensure DOM is painted before scrolling
        requestAnimationFrame(() => {
          window.scrollTo({ top: y, behavior: 'instant' });
        });
      }
    }

    // Save scroll position on unmount
    return () => {
      sessionStorage.setItem(storageKey, String(Math.round(window.scrollY)));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, key]);
}

