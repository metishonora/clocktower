import {useEffect, useRef, type ReactNode} from 'react';
import {FuneralIcon, GhostVoteIcon} from '../features/grimoire/SeatStateIcons';
import './styles/votingList.css';

/** Presentation values only: each runtime supplies eligibility and the counted total. */
export type VotingListPlayer = {
  id: string; seat: number; name: string; alive: boolean; ghostVoteUsed: boolean;
  eligible: boolean; forced?: boolean; excluded?: boolean;
};

export function VotingList({players, nominatorId, nomineeId, voterIds, cursor, count, targetVotes,
  complete = false, busy = false, ready = true, resultSummary, note, onVote, onReset, onCancel,
  onConfirm, onComplete, cancelLabel = '투표 취소 →',
}: {
  players: VotingListPlayer[]; nominatorId?: string; nomineeId?: string; voterIds: string[];
  cursor: number; count: number; targetVotes: number; complete?: boolean; busy?: boolean; ready?: boolean;
  resultSummary?: ReactNode; note?: ReactNode; cancelLabel?: string;
  onVote: (id: string, raised: boolean, nextCursor: number) => void;
  onReset: () => void; onCancel: () => void; onConfirm: () => void; onComplete?: () => void;
}) {
  const surface = useRef<HTMLElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const seated = [...players].sort((a,b) => a.seat - b.seat);
  const nomineeIndex = seated.findIndex(p => p.id === nomineeId);
  const ordered = [...seated.slice(nomineeIndex + 1), ...seated.slice(0, nomineeIndex + 1)];
  const next = complete ? -1 : ordered.findIndex((p,i) => i >= cursor && p.eligible && !p.forced);
  const current = ordered[next];
  const person = (id?: string) => {const p = players.find(p => p.id === id); return p ? `${p.seat}번 ${p.name}` : '선택 전';};
  const ghosts = ordered.filter(p => !p.alive && voterIds.includes(p.id));
  useEffect(() => {
    const alignSurface = () => surface.current?.scrollIntoView?.({block:'start', behavior:'instant'});
    alignSurface();
    window.addEventListener('resize',alignSurface);
    return () => window.removeEventListener('resize',alignSurface);
  }, [nomineeId,complete]);
  useEffect(() => {
    const keepCurrentVisible = () => {
      const box = list.current, row = box?.children[next] as HTMLElement | undefined;
      if (!box || !row) return;
      const view = box.getBoundingClientRect(), rect = row.getBoundingClientRect();
      if (rect.top < view.top) box.scrollBy?.({top:rect.top - view.top, behavior:'smooth'});
      else if (rect.bottom + rect.height > view.bottom) box.scrollBy?.({top:rect.bottom + rect.height - view.bottom, behavior:'smooth'});
    };
    keepCurrentVisible();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(keepCurrentVisible);
    if(list.current)observer?.observe(list.current);
    return () => observer?.disconnect();
  }, [next]);
  function answer(raised: boolean) { if (!busy && !complete && current) onVote(current.id, raised, next + 1); }
  return <section ref={surface} className="snvSeatingSurface issue116GrimoireSurface issue116VoteMode votingListSurface" aria-label="투표 화면">
    <section className="vlLedger" aria-label="투표 순서 목록">
      <header className="vlLedgerHeader">
        <h2 className="vlTitle">{complete ? '투표 결과' : '투표'}</h2>
        <div className="vlNominee"><span>피지명자</span><strong>{person(nomineeId)}</strong><small>지명자 {person(nominatorId)}</small></div>
        <div className="vlHeaderActions">{complete ? <span className="vlConfirmedBadge">투표 확정</span> : <>
          <button type="button" className="vlReset" aria-label="투표 초기화 X" disabled={busy} onClick={onReset}>초기화</button>
          <button type="button" className="vlReset" aria-label={cancelLabel} disabled={busy} onClick={onCancel}>{cancelLabel.replace(' →','')}</button>
        </>}</div>
      </header>
      <ol ref={list} className="vlRows" aria-label="투표자 선택">
        {ordered.map((p,index) => {
          const selected = voterIds.includes(p.id);
          const spent = !p.alive && p.ghostVoteUsed && !(complete && selected);
          const unavailable = !p.eligible && !(complete && selected);
          const ghostLabel = p.alive ? undefined : spent ? '유령표 소진' : selected ? complete ? '유령표 사용' : '유령표 사용 예정' : '유령표 가능';
          const label = p.forced ? '강제 투표' : selected && p.excluded ? '집계 제외' : ghostLabel;
          const passed = !complete && (next < 0 || index < next) && !selected && !unavailable;
          return <li key={p.id}><button type="button"
            className={`vlRow${selected ? ' isSelected' : ''}${unavailable ? ' isUnavailable' : ''}${p.forced ? ' isForced' : ''}${p.id === nomineeId ? ' isNominee' : ''}${index === next ? ' isCursor' : ''}${passed ? ' isPassed' : ''}${spent ? ' snvGhostVoteSpent' : ''}`}
            aria-label={`${p.seat}번 좌석, ${p.name}, ${p.alive ? '생존' : spent || complete && selected ? '사망 · 유령표 사용함' : '사망 · 유령표 사용 가능'}${p.id === nomineeId ? ', 피지명자, 마지막' : index === 0 ? ', 시작' : ''}${label ? `, ${label}` : ''}`}
            aria-current={index === next ? 'step' : undefined} aria-pressed={selected}
            disabled={busy || complete || unavailable || p.forced}
            onClick={() => onVote(p.id, !selected, next >= 0 && index >= next ? index + 1 : cursor)}>
            <span className="vlSeatNumber">{p.seat}<small>번</small></span>
            <span className="vlIdentity"><strong>{p.name}</strong><span>{index === 0 ? <em>시작</em> : p.id === nomineeId ? <em>피지명자 · 마지막</em> : null}{label && label !== '유령표 가능' ? <small className="vlGhostState">{!p.alive && <GhostVoteIcon/>}{label}</small> : null}</span></span>
            <span className="vlRole">{p.alive ? null : spent ? <FuneralIcon/> : <GhostVoteIcon/>}</span>
            <span className="vlVoteMark" aria-hidden="true">{selected ? <CheckIcon/> : unavailable ? <LockIcon/> : null}</span>
          </button></li>;
        })}
      </ol>
      <aside className="vlSide">
        <div className="vlTally" role="status" aria-label="투표 집계" aria-live="polite" aria-atomic="true">
          <div><span>{complete ? '확정' : '현재'}</span><strong>{count}<small>표</small></strong></div>
          {complete ? <p>{resultSummary}</p> : <div className="vlNeed"><span>필요</span><strong>{targetVotes}<small>표</small></strong></div>}
        </div>
        {ghosts.length > 0 && <p className="vlGhostSummary">유령표 {complete ? '사용' : '사용 예정'}: {ghosts.map(p => person(p.id)).join(' · ')}</p>}
        {note && <div className="vlNote">{note}</div>}
      </aside>
      <footer className="vlLedgerFooter">
        {!complete && <><button type="button" className="vlAnswerNo" disabled={busy || !current} onClick={() => answer(false)}>안함</button><button type="button" className="vlAnswerYes" disabled={busy || !current} onClick={() => answer(true)}>투표함</button></>}
        <button type="button" className="issue116PrimaryAction" disabled={busy || (!complete && !ready)} aria-label={complete ? '투표 완료 →' : `${count}표로 투표 확정`} onClick={complete ? onComplete : onConfirm}>{complete ? '투표 완료 →' : `${count}표로 확정`}</button>
      </footer>
    </section>
  </section>;
}
function CheckIcon() { return <svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>; }
function LockIcon() { return <svg viewBox="0 0 24 24"><rect x="6" y="10" width="12" height="10" rx="2"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/></svg>; }
