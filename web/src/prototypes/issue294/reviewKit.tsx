import { useEffect, useRef, useState, type ReactNode } from 'react';

export function useWide() {
  const query = '(min-width: 760px)';
  const [wide, setWide] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
}

// iOS Safari는 키보드가 올라와도 레이아웃 뷰포트를 줄이지 않으므로 visualViewport 높이를 직접 쓴다.
export function useViewportHeight(active: boolean) {
  const [h, setH] = useState<number | null>(null);
  useEffect(() => {
    if (!active || !window.visualViewport) return;
    const vv = window.visualViewport;
    const on = () => {
      setH(vv.height);
      window.scrollTo(0, 0);
    };
    on();
    vv.addEventListener('resize', on);
    vv.addEventListener('scroll', on);
    return () => {
      vv.removeEventListener('resize', on);
      vv.removeEventListener('scroll', on);
    };
  }, [active]);
  return h;
}

export function PhoneFrame({ simKeyboard, children }: { simKeyboard: boolean; children: ReactNode }) {
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const isField = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT');
    const onIn = (e: FocusEvent) => setFocused(isField(e.target));
    const onOut = (e: FocusEvent) => setFocused(isField(e.relatedTarget));
    el.addEventListener('focusin', onIn);
    el.addEventListener('focusout', onOut);
    return () => {
      el.removeEventListener('focusin', onIn);
      el.removeEventListener('focusout', onOut);
    };
  }, []);
  const kb = simKeyboard && focused;
  return (
    <div className="rv-phone">
      <div className="rv-phone-screen" ref={ref}>
        <div className="rv-phone-app">{children}</div>
        {kb && (
          <div className="rv-keyboard" onMouseDown={(e) => e.preventDefault()}>
            <span>키보드 자리</span>
          </div>
        )}
      </div>
    </div>
  );
}

