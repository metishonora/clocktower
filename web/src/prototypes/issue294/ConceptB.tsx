import { useEffect, useMemo, useRef, useState } from 'react';
import { aliveCount, meSeat, myRole, phase, seatName, seats, votesNeeded, type Message, type Thread } from './fixture';
import { autosize, inThread, useDrafts, useStickToBottom } from './shared';
import { formatClock, type Game } from './useGame';
import './conceptB.css';

type Sheet = 'peek' | 'full';

const pos = (seat: number) => {
  const a = ((seat - 1) / seats.length) * Math.PI * 2;
  return { x: 50 + 40 * Math.sin(a), y: 50 - 39 * Math.cos(a) };
};

export function ConceptB({ game }: { game: Game }) {
  const [sheet, setSheet] = useState<Sheet>('peek');
  const [thread, setThread] = useState<Thread>('public');
  const { drafts, setDraft } = useDrafts();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const items = useMemo(() => game.messages.filter((m) => inThread(m, thread)), [game.messages, thread]);
  const list = useStickToBottom(items, thread);
  const draft = drafts[thread] ?? '';
  const vote = game.vote;
  const voteLive = !!vote && game.secondsLeft > 0;
  const whisperUnread = game.unread['whisper:4'] ?? 0;
  const whisperThreads = useMemo(() => {
    const set = new Set<number>();
    game.messages.forEach((m) => m.kind === 'chat' && m.thread !== 'public' && set.add(Number(m.thread.split(':')[1])));
    if (thread !== 'public') set.add(Number(thread.split(':')[1]));
    return [...set];
  }, [game.messages, thread]);

  useEffect(() => {
    if (sheet === 'full') game.markRead(thread);
  }, [sheet, thread, items.length, game.markRead]);
  useEffect(() => autosize(inputRef.current), [draft, thread, sheet]);

  const openThread = (t: Thread) => {
    setThread(t);
    setSheet('full');
  };
  const showTable = () => {
    inputRef.current?.blur();
    setSheet('peek');
  };
  const send = () => {
    const text = draft.trim();
    if (!text) return;
    game.send(text, thread);
    setDraft(thread, '');
  };

  const peekItems = items.filter((m) => m.kind === 'chat' || m.tone !== undefined).slice(-3);
  const from = vote ? pos(vote.nominator) : null;
  const to = vote ? pos(vote.nominee) : null;

  return (
    <div className={`cb sheet-${sheet}`}>
      <header className="cb-head">
        <div>
          <span className="cb-day">{phase.label}</span>
          <span className="cb-step">{voteLive ? '투표' : phase.step}</span>
        </div>
        <button className="cb-role" type="button">
          <img src={myRole.icon} alt="" />
          {myRole.name}
        </button>
      </header>

      <div className="cb-stage">
        <div className="cb-table">
          <svg className="cb-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <ellipse cx="50" cy="50" rx="40" ry="39" />
            {voteLive && from && to && <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} className="cb-nom-line" />}
          </svg>
          {seats.map((s) => {
            const p = pos(s.seat);
            const t: Thread = `whisper:${s.seat}`;
            const unread = game.unread[t] ?? 0;
            return (
              <button
                key={s.seat}
                className={`cb-seat ${s.alive ? '' : 'dead'} ${s.me ? 'me' : ''} ${voteLive && vote!.nominee === s.seat ? 'nominee' : ''} ${voteLive && vote!.nominator === s.seat ? 'nominator' : ''}`}
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                onClick={() => !s.me && openThread(t)}
                aria-label={s.me ? `${s.name} (나)` : `${s.name}에게 귓속말`}
              >
                <span className="cb-token">
                  {s.name[0]}
                  {!s.alive && s.ghostVote && <i className="cb-ghost" />}
                  {unread > 0 && <b className="cb-unread">{unread}</b>}
                </span>
                <span className="cb-name">{s.me ? '나' : s.name}</span>
              </button>
            );
          })}
          <div className="cb-center">
            {vote && voteLive ? (
              <div className="cb-vote">
                <span className="cb-vote-kicker">{seatName(vote.nominator)}의 지명</span>
                <strong>{seatName(vote.nominee)} 처형</strong>
                <span className="cb-clock">{formatClock(game.secondsLeft)} · {votesNeeded}표 이상</span>
                <div className="cb-vote-btns">
                  <button className={vote.choice === 'raise' ? 'on' : ''} onClick={() => game.answerVote('raise')}>손 들기</button>
                  <button className={vote.choice === 'keep' ? 'on' : ''} onClick={() => game.answerVote('keep')}>들지 않기</button>
                </div>
              </div>
            ) : (
              <div className="cb-idle">
                <strong>{aliveCount}</strong>
                <span>생존 / {seats.length}</span>
                <em>처형 {votesNeeded}표</em>
              </div>
            )}
          </div>
        </div>
      </div>

      <section className="cb-sheet">
        <button className="cb-grab" onClick={() => (sheet === 'peek' ? setSheet('full') : showTable())} aria-label={sheet === 'peek' ? '대화 펼치기' : '원탁 보기'}>
          <span />
        </button>

        {sheet === 'full' && (
          <>
            {voteLive && vote ? (
              <button className={`cb-alert ${vote.choice ? 'done' : ''}`} onClick={showTable}>
                <span className="cb-alert-kind">투표</span>
                <span>{seatName(vote.nominator)} → {seatName(vote.nominee)}</span>
                <span className="cb-alert-right">
                  {vote.choice ? (vote.choice === 'raise' ? '손 듦' : '들지 않음') : '원탁에서 응답'}
                  <span className="cb-clock">{formatClock(game.secondsLeft)}</span>
                </span>
              </button>
            ) : (
              <button className="cb-strip" onClick={showTable} aria-label="원탁 보기">
                {seats.map((s) => (
                  <span key={s.seat} className={`cb-mini ${s.alive ? '' : 'dead'} ${s.me ? 'me' : ''}`}>
                    {s.name[0]}
                    {(game.unread[`whisper:${s.seat}`] ?? 0) > 0 && <b />}
                  </span>
                ))}
                <span className="cb-strip-meta">{phase.label} · 생존 {aliveCount}</span>
              </button>
            )}
            <nav className="cb-threads">
              <button aria-pressed={thread === 'public'} onClick={() => setThread('public')}>광장</button>
              {whisperThreads.map((n) => {
                const t: Thread = `whisper:${n}`;
                const u = game.unread[t] ?? 0;
                return (
                  <button key={n} aria-pressed={thread === t} onClick={() => setThread(t)}>
                    {seatName(n)}{u > 0 && thread !== t && <b>{u}</b>}
                  </button>
                );
              })}
            </nav>
            <div className="cb-list-wrap">
              <div className="cb-list" ref={list.ref} onScroll={list.onScroll}>
                {thread !== 'public' && items.length === 0 && <p className="cb-empty">{seatName(Number(thread.split(':')[1]))}에게만 보이는 대화</p>}
                {items.map((m, i) => <Row key={m.id} m={m} prev={items[i - 1]} />)}
              </div>
              {list.fresh > 0 && <button className="cb-fresh" onClick={list.jump}>새 메시지 {list.fresh}</button>}
            </div>
          </>
        )}

        {sheet === 'peek' && (
          <button className="cb-peek" onClick={() => setSheet('full')}>
            {peekItems.map((m) => (
              <span key={m.id} className="cb-peek-line">
                {m.kind === 'chat' ? <><b>{m.seat === meSeat ? '나' : seatName(m.seat)}</b> {m.text}</> : <em>{m.text}</em>}
              </span>
            ))}
            {(whisperUnread > 0 || (game.unread.public ?? 0) > 0) && (
              <span className="cb-peek-badge">
                {whisperUnread > 0 ? `귓속말 ${whisperUnread}` : `새 메시지 ${game.unread.public}`}
              </span>
            )}
          </button>
        )}

        <form className="cb-compose" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <span className="cb-target">{thread === 'public' ? '광장' : seatName(Number(thread.split(':')[1]))}</span>
          <textarea
            ref={inputRef}
            rows={1}
            value={draft}
            placeholder={thread === 'public' ? '모두에게 말하기' : '귓속말'}
            onFocus={() => setSheet('full')}
            onChange={(e) => setDraft(thread, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button type="submit" disabled={!draft.trim()} onMouseDown={(e) => e.preventDefault()} aria-label="보내기">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 12h13M12 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </form>
      </section>
    </div>
  );
}

function Row({ m, prev }: { m: Message; prev?: Message }) {
  if (m.kind === 'announce') return <p className={`cb-announce ${m.tone ?? ''}`}>{m.text}</p>;
  const mine = m.seat === meSeat;
  const seat = seats.find((s) => s.seat === m.seat)!;
  const grouped = prev?.kind === 'chat' && prev.seat === m.seat;
  return (
    <div className={`cb-msg ${mine ? 'mine' : ''} ${grouped ? 'grouped' : ''} ${seat.alive ? '' : 'ghost'}`}>
      {!grouped && !mine && <span className="cb-who">{seat.name}{!seat.alive && ' · 유령'}</span>}
      <div className="cb-bubble">{m.text}<time>{m.time}</time></div>
    </div>
  );
}
