import { useEffect, useMemo, useRef, useState } from 'react';
import { aliveCount, meSeat, myRole, phase, seatName, seats, votesNeeded, type Message, type Thread } from './fixture';
import { autosize, inThread, useDrafts, useStickToBottom } from './shared';
import { formatClock, type Game } from './useGame';
import './conceptA.css';

const hue: Record<number, string> = { 1: '#a0522d', 2: '#4f6d7a', 3: '#2b2620', 4: '#6b5b95', 5: '#7a7a52', 6: '#3f7f6a', 7: '#b06a83', 8: '#8a6a3f' };

export function ConceptA({ game }: { game: Game }) {
  const [thread, setThread] = useState<Thread>('public');
  const { drafts, setDraft } = useDrafts();
  const [voteOpen, setVoteOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const items = useMemo(() => game.messages.filter((m) => inThread(m, thread)), [game.messages, thread]);
  const list = useStickToBottom(items, thread);
  const whisperUnread = game.unread['whisper:4'] ?? 0;
  const draft = drafts[thread] ?? '';

  useEffect(() => game.markRead(thread), [thread, items.length, game.markRead]);

  const lastWhisper = useRef(whisperUnread);
  useEffect(() => {
    if (whisperUnread > lastWhisper.current && thread !== 'whisper:4') {
      setToast('도윤');
      const t = window.setTimeout(() => setToast(null), 5000);
      lastWhisper.current = whisperUnread;
      return () => window.clearTimeout(t);
    }
    lastWhisper.current = whisperUnread;
  }, [whisperUnread, thread]);

  useEffect(() => {
    if (game.vote && !game.vote.choice) setVoteOpen(false);
  }, [game.vote?.id]);

  useEffect(() => autosize(inputRef.current), [draft, thread]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    game.send(text, thread);
    setDraft(thread, '');
    inputRef.current?.focus();
  };

  const vote = game.vote;
  const voteLive = vote && game.secondsLeft > 0;

  return (
    <div className={`ca ${typing ? 'typing' : ''}`}>
      <header className="ca-head">
        <div className="ca-phase">
          <span className="ca-day">{phase.label}</span>
          <span className="ca-step">{vote && voteLive ? '투표' : phase.step}</span>
        </div>
        <button className="ca-role" type="button">
          <img src={myRole.icon} alt="" />
          {myRole.name}
        </button>
      </header>

      <ol className="ca-seats" aria-label="좌석">
        {seats.map((s) => (
          <li key={s.seat} className={`${s.alive ? '' : 'dead'} ${s.me ? 'me' : ''} ${vote && voteLive && vote.nominee === s.seat ? 'nominee' : ''}`}>
            <span className="ca-avatar" style={{ ['--c' as string]: hue[s.seat] }}>
              {s.name[0]}
              {!s.alive && s.ghostVote && <i className="ca-ghost" aria-label="유령 투표권 있음" />}
            </span>
            <span className="ca-seat-name">{s.me ? '나' : s.name}</span>
          </li>
        ))}
      </ol>

      <nav className="ca-tabs">
        <button aria-pressed={thread === 'public'} onClick={() => setThread('public')}>
          광장
        </button>
        <button aria-pressed={thread === 'whisper:4'} onClick={() => setThread('whisper:4')}>
          귓속말 · 도윤{whisperUnread > 0 && thread !== 'whisper:4' && <b className="ca-badge">{whisperUnread}</b>}
        </button>
      </nav>

      <div className="ca-list-wrap">
        {toast && (
          <button className="ca-toast" onClick={() => { setThread('whisper:4'); setToast(null); }}>
            <span className="ca-avatar sm" style={{ ['--c' as string]: hue[4] }}>도</span>
            도윤의 귓속말
            <span className="ca-toast-go">보기</span>
          </button>
        )}
        <div className="ca-list" ref={list.ref} onScroll={list.onScroll}>
          {thread !== 'public' && items.length === 0 && <p className="ca-empty">도윤과의 귓속말</p>}
          {items.map((m, i) => (
            <Row key={m.id} m={m} prev={items[i - 1]} />
          ))}
        </div>
        {list.fresh > 0 && (
          <button className="ca-fresh" onClick={list.jump}>
            새 메시지 {list.fresh}
          </button>
        )}
      </div>

      {vote && (
        <section className={`ca-dock ${vote.choice ? 'done' : ''} ${voteOpen ? 'open' : ''}`} key={vote.id}>
          {voteOpen && voteLive ? (
            <>
              <div className="ca-dock-head">
                <strong>{seatName(vote.nominee)} 처형에 투표</strong>
                <span className="ca-clock">{formatClock(game.secondsLeft)}</span>
              </div>
              <p className="ca-dock-sub">
                {seatName(vote.nominator)} 지명 · 생존 {aliveCount}명 중 {votesNeeded}표 이상
              </p>
              <div className="ca-vote-btns">
                <button className={vote.choice === 'raise' ? 'on' : ''} onClick={() => { game.answerVote('raise'); setVoteOpen(false); }}>
                  손 들기
                </button>
                <button className={vote.choice === 'keep' ? 'on' : ''} onClick={() => { game.answerVote('keep'); setVoteOpen(false); }}>
                  들지 않기
                </button>
              </div>
            </>
          ) : (
            <button className="ca-dock-bar" onClick={() => voteLive && setVoteOpen(true)} disabled={!voteLive}>
              <span className="ca-dock-kind">투표</span>
              <span className="ca-dock-title">{seatName(vote.nominee)} 처형</span>
              {voteLive ? (
                vote.choice ? (
                  <span className="ca-dock-state">{vote.choice === 'raise' ? '손 듦' : '들지 않음'} · 바꾸기</span>
                ) : (
                  <span className="ca-dock-cta">응답하기</span>
                )
              ) : (
                <span className="ca-dock-state">마감</span>
              )}
              {voteLive && <span className="ca-clock">{formatClock(game.secondsLeft)}</span>}
            </button>
          )}
        </section>
      )}

      <form className="ca-compose" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <span className="ca-target">{thread === 'public' ? '광장' : '도윤'}</span>
        <textarea
          ref={inputRef}
          rows={1}
          value={draft}
          placeholder={thread === 'public' ? '모두에게 말하기' : '도윤에게만 말하기'}
          onFocus={() => setTyping(true)}
          onBlur={() => setTyping(false)}
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
    </div>
  );
}

function Row({ m, prev }: { m: Message; prev?: Message }) {
  if (m.kind === 'announce') {
    return (
      <div className={`ca-announce ${m.tone ?? ''}`}>
        <span>{m.text}</span>
      </div>
    );
  }
  const mine = m.seat === meSeat;
  const grouped = prev?.kind === 'chat' && prev.seat === m.seat;
  const seat = seats.find((s) => s.seat === m.seat)!;
  return (
    <div className={`ca-msg ${mine ? 'mine' : ''} ${grouped ? 'grouped' : ''} ${seat.alive ? '' : 'ghost'}`}>
      {!mine && (
        <span className="ca-avatar sm" style={{ ['--c' as string]: hue[m.seat], visibility: grouped ? 'hidden' : undefined }}>
          {seat.name[0]}
        </span>
      )}
      <div className="ca-bubble-col">
        {!mine && !grouped && (
          <span className="ca-name">
            {seat.name}
            {!seat.alive && <em> · 유령</em>}
          </span>
        )}
        <div className="ca-bubble">{m.text}</div>
      </div>
      <time>{m.time}</time>
    </div>
  );
}
