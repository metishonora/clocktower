import { useEffect, useState, type PointerEvent, type RefObject } from 'react';
import { EnvelopeIcon } from './plazaParts';

export type WhisperArrival = { id: number; seat: number; name: string; at: number };

export function WhisperAction({ arrival, unread, expanded, windowOpen, buttonRef, onPointerDown, onToggle, onOpen }: {
  arrival: WhisperArrival | null;
  unread: number;
  expanded: boolean;
  windowOpen: boolean;
  buttonRef: RefObject<HTMLButtonElement | null>;
  onPointerDown: (event: PointerEvent) => void;
  onToggle: () => void;
  onOpen: (seat: number) => void;
}) {
  const [shownId, setShownId] = useState<number | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const preview = arrival && arrival.id === shownId ? arrival : null;
  useEffect(() => { setShownId(arrival && Date.now() - arrival.at < 6000 ? arrival.id : null); }, [arrival?.id]);
  useEffect(() => {
    if (!preview || hovered || focused) return;
    const timeout = window.setTimeout(() => setShownId(null), Math.max(0, 6000 - (Date.now() - preview.at)));
    return () => window.clearTimeout(timeout);
  }, [preview?.id, hovered, focused]);

  return <>
    <button ref={buttonRef} type="button"
      className={`pz-act sp-whisper-action ${expanded ? 'is-active' : ''} ${preview ? 'has-arrival' : ''}`}
      aria-label={preview ? `${preview.name}에게서 새 귓속말, 안 읽은 메시지 ${unread}개. 대화 열기` : `귓속말${unread ? `, 안 읽은 메시지 ${unread}개` : ''}`}
      aria-expanded={preview ? false : expanded} aria-controls={windowOpen && !preview ? 'sp-chat-window' : undefined}
      onPointerDown={onPointerDown} onClick={() => preview ? onOpen(preview.seat) : onToggle()}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
      {preview ? <span key={`arrival-${preview.id}`} className="sp-whisper-arrival" aria-hidden="true">
        <span className="sp-whisper-envelope"><EnvelopeIcon /></span>
        <span className="sp-whisper-arrival-copy"><small>{preview.name}에게서</small><strong>새 귓속말</strong></span>
        <span className="sp-whisper-flare" />
      </span> : <><EnvelopeIcon />귓속말{expanded && <span className="sp-fold-mark" aria-hidden="true">⌄</span>}</>}
      {unread > 0 && <span key={preview ? `badge-${preview.id}` : 'unread'} className={`sp-whisper-badge ${preview ? 'is-arriving' : ''}`} aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
    </button>
    <span className="sp-whisper-live" role="status" aria-atomic="true">{preview && <span key={preview.id}>{preview.name}에게서 새 귓속말이 도착했습니다.</span>}</span>
  </>;
}
