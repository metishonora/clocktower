import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import './notices.css';

export type SpeakingNotice = { id: number; text: string; at: string; read: boolean };

function Megaphone() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 9 12-5v16L4 15H2V9h2Zm0 0v6m3 1 1 5h4l-2-4M20 8l2-1m-2 9 2 1m-2-5h3" /></svg>;
}

export function NoticeHub({ notices, onRead }: { notices: SpeakingNotice[]; onRead: () => void }) {
  const latest = notices.at(-1);
  const unread = notices.filter((notice) => !notice.read).length;
  const [expanded, setExpanded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const hub = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  // New arrivals replace the preview, but every message remains in history.
  useEffect(() => {
    setExpanded(Boolean(latest && !latest.read && !historyOpen));
  }, [latest?.id]);
  useEffect(() => {
    if (!expanded || historyOpen || hovered || focused) return;
    const timer = window.setTimeout(() => setExpanded(false), 6000);
    return () => window.clearTimeout(timer);
  }, [expanded, latest?.id, historyOpen, hovered, focused]);
  useEffect(() => { if (historyOpen) onRead(); }, [historyOpen, latest?.id, onRead]);
  useEffect(() => {
    if (!historyOpen) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('.sp-plaza') && !hub.current?.contains(event.target)) setHistoryOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      const restoreFocus = hub.current?.contains(document.activeElement);
      flushSync(() => setHistoryOpen(false));
      if (restoreFocus) trigger.current?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', escape, true);
    };
  }, [historyOpen]);

  const closeHistory = () => {
    flushSync(() => setHistoryOpen(false));
    trigger.current?.focus({ preventScroll: true });
  };
  const toggleHistory = () => {
    if (historyOpen) { closeHistory(); return; }
    flushSync(() => { setExpanded(false); setHistoryOpen(true); });
    heading.current?.focus({ preventScroll: true });
  };
  const preview = expanded && !historyOpen;
  return <div ref={hub} className={`sp-notice-hub ${preview ? 'is-expanded' : ''} ${historyOpen ? 'is-history-open' : ''} ${unread ? 'has-unread' : ''}`}>
    <div className="sp-notice-anchor">
      <button ref={trigger} type="button" className="sp-notice-trigger" aria-label={`공지 이력${unread ? `, 새 공지 ${unread}개` : ''}${preview && latest ? `. ${latest.text}` : ''}`} aria-expanded={historyOpen} aria-controls={historyOpen ? 'sp-notice-history' : undefined}
        onPointerDown={(e) => e.preventDefault()} onClick={toggleHistory} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
        <span key={latest?.id} className="sp-megaphone"><Megaphone /></span>
        <span className="sp-notice-preview" aria-hidden="true">{latest?.text}</span>
        {preview && <span className="sp-notice-arrow" aria-hidden="true">›</span>}
      </button>
      {unread > 0 && <span className="sp-notice-count" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
    </div>
    <p className="sp-notice-live" role="status" aria-atomic="true">{latest && !latest.read ? `이야기꾼 공지: ${latest.text}` : ''}</p>
    {historyOpen && <div className="sp-notice-history-wrap"><section id="sp-notice-history" className="sp-notice-history" role="dialog" aria-labelledby="sp-notice-history-title">
      <header><h2 id="sp-notice-history-title" ref={heading} tabIndex={-1}>공지 이력</h2><span>{notices.length}</span><button type="button" aria-label="공지 이력 닫기" onClick={closeHistory}>×</button></header>
      {notices.length ? <ol aria-label="이야기꾼 공지 목록">{[...notices].reverse().map((notice, index) => <li key={notice.id} className={index === 0 ? 'is-latest' : ''}>
        <div className="sp-notice-meta"><span>이야기꾼</span><time>{notice.at}</time>{index === 0 && <b>최근</b>}</div><p>{notice.text}</p>
      </li>)}</ol> : <p className="sp-notice-empty">아직 공지가 없습니다.</p>}
    </section></div>}
  </div>;
}
