import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let openOverlays = 0;

/** Focus trap + Escape + scroll lock + focus restore, shared by Dialog and Drawer. */
export function useOverlay(open, onClose, panelRef) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    openOverlays += 1;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    const focusFirst = () => {
      const target = panel?.querySelector('[data-autofocus]') || panel?.querySelector(FOCUSABLE) || panel;
      target?.focus({ preventScroll: true });
    };
    const frame = requestAnimationFrame(focusFirst);

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const items = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown, true);
      openOverlays -= 1;
      if (openOverlays === 0) document.body.style.overflow = '';
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus({ preventScroll: true });
    };
  }, [open, panelRef]);
}
