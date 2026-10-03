import { useLayoutEffect, useRef } from 'react';

// Keep keyboard animation out of React's render loop and keep the square's
// original height. Only the floating conversation follows the visible height.
export function useMobileViewport(active: boolean) {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = root.current;
    if (!active || !el) return;
    const viewport = window.visualViewport;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let lastInset = -1;
    let frame = 0;
    let followUntil = 0;
    const isIOS = /iP(ad|hone|od)/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const focusFrames = new Map<HTMLTextAreaElement, { frame: number; transform: string }>();

    const update = () => {
      frame = 0;
      // Leave native pinch zoom alone.
      if (!viewport || Math.abs(viewport.scale - 1) < .01) {
        if (window.innerWidth !== width) {
          width = window.innerWidth;
          height = window.innerHeight;
        }
        if (el.style.height !== `${height}px`) el.style.height = `${height}px`;
        const inset = Math.max(0, height - (viewport?.height ?? window.innerHeight));
        if (inset !== lastInset) {
          el.style.setProperty('--viewport-bottom-inset', `${inset}px`);
          lastInset = inset;
        }
      }
      if (performance.now() < followUntil) frame = requestAnimationFrame(update);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const followKeyboard = () => {
      // Some mobile browsers batch viewport events until an animation finishes.
      followUntil = performance.now() + 700;
      schedule();
    };
    const restorePagePosition = () => {
      if ((!viewport || Math.abs(viewport.scale - 1) < .01) && (window.scrollX || window.scrollY)) {
        window.scrollTo({ left: 0, top: 0, behavior: 'instant' });
      }
      schedule();
    };

    // iOS may ignore preventScroll for a visible input near the keyboard.
    // Move only the input for the focus frame, before Safari decides to pan.
    // Reference: https://github.com/Temzasse/react-modal-sheet/blob/main/src/hooks/use-prevent-scroll.ts
    const prepareFocus = (input: HTMLTextAreaElement) => {
      if (!isIOS || focusFrames.has(input)) return;
      const transform = input.style.transform;
      input.style.transform = 'translateY(-2000px)';
      const id = requestAnimationFrame(() => {
        input.style.transform = transform;
        focusFrames.delete(input);
      });
      focusFrames.set(input, { frame: id, transform });
    };
    const onFocus = (event: FocusEvent) => {
      if (event.target instanceof HTMLTextAreaElement) prepareFocus(event.target);
      followKeyboard();
    };

    let gesture: { x: number; y: number; lastY: number; moved: boolean; scroller: HTMLElement | null } | null = null;
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || (viewport && Math.abs(viewport.scale - 1) >= .01)) { gesture = null; return; }
      const touch = event.touches[0];
      const target = event.target instanceof Element ? event.target : null;
      gesture = {
        x: touch.clientX, y: touch.clientY, lastY: touch.clientY, moved: false,
        scroller: target?.closest<HTMLElement>('.sp-conversation ol, .sp-notice-history ol, .rg-catalog, .rv-bar-body, textarea') ?? null,
      };
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!gesture || event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (Math.hypot(touch.clientX - gesture.x, touch.clientY - gesture.y) > 8) gesture.moved = true;
      const dy = touch.clientY - gesture.lastY;
      gesture.lastY = touch.clientY;
      const scroller = gesture.scroller;
      // Preserve caret placement, selection and scrolling inside the editor.
      if (scroller instanceof HTMLTextAreaElement) return;
      const canScroll = scroller && (dy < 0
        ? scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 1
        : scroller.scrollTop > 0);
      if (!canScroll && event.cancelable) event.preventDefault();
    };
    const onTouchEnd = (event: TouchEvent) => {
      const tap = gesture && !gesture.moved && event.touches.length === 0;
      gesture = null;
      const input = event.target;
      const sendButton = input instanceof Element ? input.closest<HTMLButtonElement>('button[data-preserve-editor-focus]') : null;
      if (tap && sendButton && document.activeElement instanceof HTMLTextAreaElement && event.cancelable) {
        // Consume the tap before Safari can blur the editor or dispatch a late
        // compatibility click after clearing the draft changes the layout.
        event.preventDefault();
        if (!sendButton.disabled) sendButton.click();
        return;
      }
      if (!isIOS || !tap || !(input instanceof HTMLTextAreaElement) || input === document.activeElement) return;
      if (event.cancelable) event.preventDefault();
      prepareFocus(input);
      input.focus({ preventScroll: true });
    };
    const cancelTouch = () => { gesture = null; };

    update();
    restorePagePosition();
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', restorePagePosition, { passive: true });
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    el.addEventListener('focusin', onFocus);
    el.addEventListener('focusout', followKeyboard);
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });
    el.addEventListener('touchcancel', cancelTouch);
    return () => {
      cancelAnimationFrame(frame);
      focusFrames.forEach(({ frame, transform }, input) => { cancelAnimationFrame(frame); input.style.transform = transform; });
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', restorePagePosition);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      el.removeEventListener('focusin', onFocus);
      el.removeEventListener('focusout', followKeyboard);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', cancelTouch);
    };
  }, [active]);
  return root;
}
