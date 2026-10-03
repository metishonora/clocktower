import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { dayLabel, role, type Cast, type Line } from './cast';
import { Backdrop, EnvelopeIcon, Figure, Ground, layout, Sun, type Depth } from './plazaParts';
import { NoticeHub, type SpeakingNotice } from './NoticeHub';
import { WhisperAction, type WhisperArrival } from './WhisperAction';
import { MessageRoleGuess, RoleGuessChip, RoleGuessPicker } from './RoleGuess';
import { readableLayout } from './readableSquare';
import './plaza.css';
import './speaking.css';
import './readableSquare.css';

export type SpeakingMessage = Line & { id: number };
export type { SpeakingNotice } from './NoticeHub';
export type SpeakingView = { kind: 'public'; seat: number | null } | { kind: 'whisper'; seat: number };

const MESSAGE_LIMIT = 100;
const messageSegmenter = typeof Intl.Segmenter === 'undefined' ? null : new Intl.Segmenter('ko', { granularity: 'grapheme' });
const messageCharacters = (value: string) => messageSegmenter ? Array.from(messageSegmenter.segment(value), (part) => part.segment) : Array.from(value);
const limitDraft = (value: string) => messageCharacters(value).slice(0, MESSAGE_LIMIT).join('');

function Conversation({ c, messages, label, empty, roleGuesses, onFilter }: { c: Cast; messages: SpeakingMessage[]; label: string; empty: string; roleGuesses?: Record<number, string>; onFilter?: (seat: number) => void }) {
  const list = useRef<HTMLOListElement>(null);
  const following = useRef(true);
  const previousLength = useRef(messages.length);
  const [unread, setUnread] = useState(0);
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    if (following.current) el.scrollTop = el.scrollHeight;
    else setUnread((n) => n + Math.max(0, messages.length - previousLength.current));
    previousLength.current = messages.length;
  }, [messages]);
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const observer = new ResizeObserver(() => { if (following.current) el.scrollTop = el.scrollHeight; });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const jump = () => {
    following.current = true;
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
    setUnread(0);
  };
  return (
    <div className="sp-conversation">
      <ol ref={list} aria-label={label} onScroll={() => {
        const el = list.current!;
        following.current = el.scrollHeight - el.scrollTop - el.clientHeight < 36;
        if (following.current) setUnread(0);
      }}>
        {messages.map((m) => {
          const p = c.players.find((p) => p.seat === m.seat)!;
          return <li key={m.id} className={`${p.me ? 'mine' : ''} ${p.alive ? '' : 'ghost'}`} style={{ ['--speaker' as string]: p.tint }}>
            <div className="sp-message-meta">
              {onFilter ? <button type="button" className="sp-message-author" aria-label={`${p.name} 발언 모아보기`} onPointerDown={(e) => e.preventDefault()} onClick={() => onFilter(p.seat)}><span />{p.name}{p.me && <small>나</small>}</button>
                : <span className="sp-message-author"><span />{p.name}{p.me && <small>나</small>}</span>}
              {!p.me && <MessageRoleGuess value={roleGuesses?.[p.seat]} />}
            </div>
            <p>{m.text}</p>
          </li>;
        })}
      </ol>
      {messages.length === 0 && <p className="sp-empty">{empty}</p>}
      {unread > 0 && <button className="sp-new-lines" type="button" onClick={jump}>새 발언 {unread}개 ↓</button>}
    </div>
  );
}

function Square({ c, messages, selectedSeat, choosingWhisper, inactive, variant, onSelect }: { c: Cast; messages: SpeakingMessage[]; selectedSeat: number | null; choosingWhisper: boolean; inactive: boolean; variant: SquareVariant; onSelect: (seat: number, trigger: HTMLButtonElement) => void }) {
  const readable = variant === 'readable';
  const depth: Depth = variant === 'soft' || variant === 'flat' ? variant : 'original';
  const square = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 390, height: 520 });
  useLayoutEffect(() => {
    if (!readable || !square.current) return;
    const element = square.current;
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [readable]);
  const spots = readable ? readableLayout(c, size.width, size.height) : layout(c, { whisper: true, depth });
  const [w1, w2] = c.whisper.map((seat) => spots.get(seat)!);
  const mid = { x: (w1.x + w2.x) / 2, y: (w1.y + w2.y) / 2, scale: (w1.scale + w2.scale) / 2 };
  const whisperTop = readable
    ? Math.abs(w1.y - w2.y) > 10 ? `${mid.y}%` : `max(32px, calc(${mid.y}% - 92px))`
    : `calc(${mid.y}% - ${92 * mid.scale}px)`;
  const shown = messages.slice(-2);
  const latest = messages.at(-1);
  const bubbles = shown.map((m, i) => {
    const s = spots.get(m.seat)!;
    const p = c.players.find((p) => p.seat === m.seat)!;
    const align = s.x < 32 ? 'start' : s.x > 68 ? 'end' : 'center';
    return <div key={m.id} className={`pz-bubble ${align} ${p.alive ? '' : 'ghost'} ${i < shown.length - 1 ? 'old' : ''}`}
      style={{ left: `${s.x}%`, top: `calc(${s.y}% - ${86 * s.scale}px)`, zIndex: 1000 + i }}>
      <b>{p.me ? '나' : p.name}</b>{m.text}
    </div>;
  });
  return <div ref={square} className={`pz-square sp-square ${readable ? 'is-readable' : ''} depth-${depth}`} aria-label="마을 광장" inert={inactive}>
    <div className="sp-people-area">
    <Ground depth={depth} />
    {c.players.map((p) => {
      const s = spots.get(p.seat)!;
      return <div key={p.seat}
        className={`pz-person ${p.alive ? '' : 'ghost'} ${p.me ? 'me' : ''} ${latest?.seat === p.seat ? 'speaking' : ''} ${selectedSeat === p.seat ? 'is-selected' : ''}`}
        style={{ left: `${s.x}%`, top: `${s.y}%`, zIndex: s.z, ['--s' as string]: s.scale }}>
        <Figure p={p} />
        <span className="pz-name">{p.me ? '나' : p.name}</span>
        <button type="button" className="sp-person-hit" aria-label={`${p.name}${p.me ? ' (나)' : ''} 선택`} aria-expanded={selectedSeat === p.seat} disabled={choosingWhisper && p.me} onClick={(e) => onSelect(p.seat, e.currentTarget)} />
      </div>;
    })}
    {depth !== 'original' && <div className="sp-name-layer" aria-hidden="true">
      {c.players.map((p) => {
        const s = spots.get(p.seat)!;
        return <span key={p.seat} className={`sp-name-tag ${p.alive ? '' : 'ghost'} ${p.me ? 'me' : ''}`} style={{ left: `${s.x}%`, top: `calc(${s.y}% - ${19 * s.scale}px)` }}>{p.me ? '나' : p.name}</span>;
      })}
    </div>}
    <div className="pz-whisper" style={{ left: `${mid.x}%`, top: whisperTop }} aria-label="귓속말 중"><span>···</span></div>
    {readable ? <div className="sq-speech">{bubbles}</div> : bubbles}
    </div>
  </div>;
}

function SendButton({ availableAt, empty, whisper }: { availableAt: number; empty: boolean; whisper: boolean }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, availableAt - performance.now()));
  useLayoutEffect(() => {
    const left = () => Math.max(0, availableAt - performance.now());
    setRemaining(left());
    if (left() === 0) return;
    const timer = window.setInterval(() => {
      const next = left();
      setRemaining(next);
      if (next === 0) window.clearInterval(timer);
    }, 50);
    return () => window.clearInterval(timer);
  }, [availableAt]);
  const seconds = Math.ceil(remaining / 1000);
  const label = seconds > 0 ? `${seconds}초 후 전송 가능` : whisper ? '귓속말 보내기' : '광장에 보내기';
  return <button className={`sp-send ${seconds > 0 ? 'is-cooling' : ''}`} type="submit" data-preserve-editor-focus aria-label={label} title={label} disabled={empty || seconds > 0} onPointerDown={(e) => e.preventDefault()}>
    {seconds > 0 ? <><svg className="sp-cooldown-ring" viewBox="0 0 38 38" aria-hidden="true"><circle cx="19" cy="19" r="16" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - Math.min(1, remaining / 3000) * 100} /></svg><span aria-hidden="true">{seconds}</span></>
      : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 18V5m-5 5 5-5 5 5" /></svg>}
  </button>;
}

export type SquareVariant = 'original' | 'readable' | 'soft' | 'flat';

export function SpeakingPlaza({ c, messages, privateMessages, whisperUnread, whisperArrival, view, setView, notices, draft, composing, sendAvailableAt, setDraft, setComposing, onSend, onBegin, onReadNotice, onReadWhisper, timeDisplay, roleGuesses, onRoleGuess, squareVariant = 'original' }: {
  c: Cast;
  messages: SpeakingMessage[];
  privateMessages: SpeakingMessage[];
  whisperUnread: Record<number, number>;
  whisperArrival: WhisperArrival | null;
  view: SpeakingView;
  setView: (value: SpeakingView) => void;
  notices: SpeakingNotice[];
  draft: string;
  composing: boolean;
  sendAvailableAt: number;
  setDraft: (value: string) => void;
  setComposing: (value: boolean) => void;
  onSend: (text: string) => boolean;
  onBegin: () => void;
  onReadNotice: () => void;
  onReadWhisper: (seat: number) => void;
  timeDisplay?: ReactNode;
  roleGuesses?: Record<number, string>;
  onRoleGuess?: (seat: number, roleId?: string) => void;
  squareVariant?: SquareVariant;
}) {
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [guessingRole, setGuessingRole] = useState(false);
  const [choosingWhisper, setChoosingWhisper] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const dockOpen = composing || choosingWhisper;
  const dockKind = choosingWhisper || (composing && view.kind === 'whisper') ? 'whisper' : 'public';
  const totalWhisperUnread = Object.values(whisperUnread).reduce((sum, unread) => sum + unread, 0);
  const selectedPerson = c.players.find((p) => p.seat === selectedSeat);
  const viewPerson = c.players.find((p) => p.seat === view.seat);
  const visibleMessages = view.kind === 'whisper' ? privateMessages : view.seat === null ? messages : messages.filter((m) => m.seat === view.seat);
  const inputLabel = view.kind === 'whisper' ? `${viewPerson!.name}에게 귓속말` : '광장에 말하기';
  const chatLabel = view.kind === 'whisper' ? `${viewPerson!.name}에게만 · 귓속말` : '광장 · 모두에게';
  const characterCount = messageCharacters(draft).length;
  const textarea = useRef<HTMLTextAreaElement>(null);
  const imeComposing = useRef(false);
  const speakButton = useRef<HTMLButtonElement>(null);
  const whisperButton = useRef<HTMLButtonElement>(null);
  const chatHeading = useRef<HTMLHeadingElement>(null);
  const personHeading = useRef<HTMLHeadingElement>(null);
  const personTrigger = useRef<HTMLButtonElement | null>(null);
  const guessTrigger = useRef<HTMLButtonElement | null>(null);
  const keepInputFocus = (e: React.PointerEvent) => { if (composing) e.preventDefault(); };

  useLayoutEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(88, Math.max(44, el.scrollHeight))}px`;
  }, [draft, composing, view.kind, view.seat]);
  useEffect(() => () => { if (closeTimer.current !== null) window.clearTimeout(closeTimer.current); }, []);

  const prepareSwitch = () => {
    // Commit an unfinished IME draft to the old channel before switching recipients.
    textarea.current?.blur();
    imeComposing.current = false;
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
    setClosing(false);
  };

  const begin = (nextView: SpeakingView = { kind: 'public', seat: null }) => {
    prepareSwitch();
    flushSync(() => {
      setSelectedSeat(null);
      setGuessingRole(false);
      setChoosingWhisper(false);
      setView(nextView);
      setComposing(true);
      if (nextView.kind === 'whisper') onReadWhisper(nextView.seat);
    });
    chatHeading.current?.focus({ preventScroll: true });
    onBegin();
  };
  const chooseWhisper = () => {
    prepareSwitch();
    personTrigger.current = null;
    flushSync(() => {
      setSelectedSeat(null);
      setGuessingRole(false);
      setComposing(false);
      setChoosingWhisper(true);
    });
    chatHeading.current?.focus({ preventScroll: true });
  };
  const closeChat = () => {
    if (closing) return;
    textarea.current?.blur();
    imeComposing.current = false;
    setClosing(true);
    const trigger = personTrigger.current ?? (dockKind === 'whisper' ? whisperButton.current : speakButton.current);
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180;
    closeTimer.current = window.setTimeout(() => {
      flushSync(() => {
        setComposing(false);
        setChoosingWhisper(false);
        setClosing(false);
      });
      closeTimer.current = null;
      trigger?.focus({ preventScroll: true });
    }, delay);
  };
  const closePerson = () => {
    flushSync(() => { setSelectedSeat(null); setGuessingRole(false); });
    personTrigger.current?.focus({ preventScroll: true });
  };
  const closeGuess = () => {
    flushSync(() => setGuessingRole(false));
    guessTrigger.current?.focus({ preventScroll: true });
  };
  const selectPerson = (seat: number, trigger: HTMLButtonElement) => {
    personTrigger.current = trigger;
    if (choosingWhisper) { begin({ kind: 'whisper', seat }); return; }
    flushSync(() => { setSelectedSeat(seat); setGuessingRole(false); });
    personHeading.current?.focus({ preventScroll: true });
  };
  const send = () => {
    const text = draft.trim();
    if (!text || characterCount > MESSAGE_LIMIT || !onSend(text)) return;
    setDraft('');
    if (view.kind === 'public' && view.seat !== null) setView({ kind: 'public', seat: null });
  };
  const onInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    // Some IMEs report keyCode 229 on the Enter that commits the final syllable.
    if (imeComposing.current || e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return;
    e.preventDefault();
    if (!e.repeat) send();
  };

  return <div className={`pz sp-plaza pz-n${c.players.length} ${composing ? 'is-composing conversation-mode' : ''} ${selectedPerson || choosingWhisper ? 'is-person-menu' : ''}`}>
    <div className="sp-surface">
      <Backdrop />
      <header className="pz-head">
        {timeDisplay ?? <div className="pz-time"><Sun /><span className="pz-day">{dayLabel}</span><span className="pz-left">토론 2:48</span></div>}
      </header>
      <Square c={c} messages={messages} selectedSeat={selectedSeat} choosingWhisper={choosingWhisper} inactive={composing} variant={squareVariant} onSelect={selectPerson} />
      <div className="sp-action-space" aria-hidden="true" />
    </div>
    <div className="sp-floating-layer">
      <NoticeHub notices={notices} onRead={onReadNotice} />
      {selectedPerson && <section className={`sp-person-card ${guessingRole ? 'is-guessing' : ''}`} role="dialog" aria-labelledby="sp-person-title" onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); if (guessingRole) closeGuess(); else closePerson(); } }}>
        <header><span className="sp-person-dot" style={{ background: selectedPerson.tint }} /><h2 id="sp-person-title" ref={personHeading} tabIndex={-1}>{selectedPerson.name}{selectedPerson.me && <small>나</small>}</h2>{selectedPerson.me ? <span className="sp-self-role"><img src={role.icon} alt="" /><span>{role.name}</span></span> : roleGuesses && <RoleGuessChip name={selectedPerson.name} value={roleGuesses[selectedPerson.seat]} expanded={guessingRole} buttonRef={guessTrigger} onClick={() => guessingRole ? closeGuess() : setGuessingRole(true)} />}{!selectedPerson.alive && <span className="sp-person-state">사망</span>}<button type="button" aria-label="인물 메뉴 닫기" onClick={closePerson}>×</button></header>
        {guessingRole && !selectedPerson.me && roleGuesses && <RoleGuessPicker key={selectedPerson.seat} name={selectedPerson.name} value={roleGuesses[selectedPerson.seat]} onSelect={(roleId) => { onRoleGuess?.(selectedPerson.seat, roleId); closeGuess(); }} />}
        <div className="sp-person-actions">
          <button type="button" onClick={() => begin({ kind: 'public', seat: selectedPerson.seat })}>발언 모아보기 <span>{messages.filter((m) => m.seat === selectedPerson.seat).length}</span></button>
          {!selectedPerson.me && <button type="button" onClick={() => begin({ kind: 'whisper', seat: selectedPerson.seat })}><EnvelopeIcon />귓속말 걸기</button>}
        </div>
      </section>}
      <div className={`sp-chat-dock channel-${dockKind} ${dockOpen ? 'is-open' : ''} ${choosingWhisper ? 'is-picking' : ''} ${closing ? 'is-closing' : ''}`} inert={closing}>
        {dockOpen && <div key={`shell-${dockKind}`} className="sp-dock-shell" aria-hidden="true"><div className="sp-dock-body" /><div className="sp-dock-stem" /></div>}
        {dockOpen && <section key={`content-${dockKind}`} id="sp-chat-window" className="sp-focus-chat" role="dialog" aria-labelledby="sp-chat-title" inert={closing} onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); closeChat(); }
        }}>
          <div className="sp-chat-heading"><h2 id="sp-chat-title" ref={chatHeading} tabIndex={-1}>{dockKind === 'whisper' && <EnvelopeIcon />}{choosingWhisper ? '귓속말 상대' : chatLabel}</h2><button type="button" onPointerDown={keepInputFocus} onClick={closeChat} aria-label="대화창 닫기"><span aria-hidden="true">×</span></button></div>
          {choosingWhisper ? <div className="sp-whisper-recipients">
            {c.players.filter((p) => !p.me).map((p) => {
              const unread = whisperUnread[p.seat] ?? 0;
              return <button key={p.seat} type="button" className={unread ? 'has-unread' : ''} onClick={() => begin({ kind: 'whisper', seat: p.seat })} aria-label={`${p.name}에게 귓속말${!p.alive ? ', 사망' : ''}${unread ? `, 안 읽은 메시지 ${unread}개` : ''}`}>
                <Figure p={p} /><span className="sp-recipient-name">{p.name}{!p.alive && <small>사망</small>}</span>
                {unread > 0 && <span className="sp-whisper-badge" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
              </button>;
            })}
          </div> : <>
        {view.kind === 'public' && viewPerson && <div className="sp-filter"><span className="sp-person-dot" style={{ background: viewPerson.tint }} /><span>{viewPerson.name}의 발언 <b>{visibleMessages.length}</b></span><button type="button" onPointerDown={keepInputFocus} onClick={() => setView({ kind: 'public', seat: null })}>전체 대화</button></div>}
        <Conversation key={`${view.kind}-${view.seat}`} c={c} messages={visibleMessages} roleGuesses={roleGuesses} label={view.kind === 'whisper' ? chatLabel : viewPerson ? `${viewPerson.name}의 광장 발언` : '광장 대화'} empty={view.kind === 'whisper' ? `${viewPerson!.name}에게 첫 귓속말을 보내세요.` : '아직 광장에 남긴 발언이 없습니다.'} onFilter={view.kind === 'public' ? (seat) => setView({ kind: 'public', seat }) : undefined} />
        <form className="sp-compose" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <div className="sp-input-row">
          <textarea ref={textarea} rows={1} aria-label={inputLabel} aria-describedby="sp-character-count" placeholder={inputLabel} enterKeyHint="send" value={draft} onChange={(e) => setDraft(imeComposing.current ? e.target.value : limitDraft(e.target.value))} onKeyDown={onInputKeyDown} onCompositionStart={() => { imeComposing.current = true; }} onCompositionEnd={(e) => { imeComposing.current = false; setDraft(limitDraft(e.currentTarget.value)); }} onBlur={(e) => { imeComposing.current = false; setDraft(limitDraft(e.currentTarget.value)); }} />
          <span id="sp-character-count" className={`sp-character-count ${characterCount >= MESSAGE_LIMIT ? 'at-limit' : ''}`}>{characterCount} / {MESSAGE_LIMIT}</span>
          <SendButton availableAt={sendAvailableAt} empty={!draft.trim() || characterCount > MESSAGE_LIMIT} whisper={view.kind === 'whisper'} />
        </div>
        </form>
        </>}
      </section>}
      <nav className="sp-actions" aria-label="대화 선택">
        <button ref={speakButton} type="button" className={`pz-speak ${dockOpen && dockKind === 'public' ? 'is-active' : ''}`} aria-expanded={dockOpen && dockKind === 'public'} aria-controls={dockOpen ? 'sp-chat-window' : undefined} onPointerDown={keepInputFocus} onClick={() => { personTrigger.current = null; if (dockOpen && dockKind === 'public' && !closing) closeChat(); else begin(); }}>광장에 말하기{dockOpen && dockKind === 'public' && <span className="sp-fold-mark" aria-hidden="true">⌄</span>}</button>
        <WhisperAction buttonRef={whisperButton} arrival={whisperArrival && whisperUnread[whisperArrival.seat] > 0 ? whisperArrival : null}
          unread={totalWhisperUnread} expanded={dockOpen && dockKind === 'whisper'} windowOpen={dockOpen} onPointerDown={keepInputFocus}
          onOpen={(seat) => { personTrigger.current = null; begin({ kind: 'whisper', seat }); }}
          onToggle={() => { if (dockOpen && dockKind === 'whisper' && !closing) closeChat(); else chooseWhisper(); }} />
      </nav>
      </div>
    </div>
  </div>;
}
