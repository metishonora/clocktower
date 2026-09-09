import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { catalog } from '../../custom/authoring/characterPresentation';
import { actorIds, archive, bluffOptions, character, makePlayers, makeStressPlayers, stepLabels, type Entry, type Player, type Snapshot } from './storyData';
import './storyConsole.css';

type View = 'story' | 'seating' | 'storage';
function particle(name: string, consonant: string, vowel: string) { const code = name.charCodeAt(name.length - 1) - 0xac00; return code >= 0 && code <= 11171 && code % 28 !== 0 ? consonant : vowel; }
type Disclosure = { title: string; text: string; bluffs: string[]; entry?: Entry };
function Sigil({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 200 200" fill="none" aria-hidden="true"><circle cx="100" cy="100" r="83"/><circle cx="100" cy="100" r="73"/><path d="M100 17L149 167L22 70H178L51 167Z"/><path d="M100 0V29M100 171V200M0 100H29M171 100H200"/><path d="M62 100Q100 60 138 100Q100 140 62 100Z"/><ellipse cx="100" cy="100" rx="9" ry="18"/><circle cx="100" cy="17" r="3"/><circle cx="178" cy="70" r="3"/><circle cx="149" cy="167" r="3"/><circle cx="51" cy="167" r="3"/><circle cx="22" cy="70" r="3"/></svg>;
}
function Eye({ closed = false }: { closed?: boolean }) { return <svg viewBox="0 0 28 22" fill="none" aria-hidden="true"><path d="M2 11Q14-5 26 11Q14 27 2 11Z"/><ellipse cx="14" cy="11" rx="4" ry="6"/>{closed && <path d="M3 21L25 1"/>}</svg>; }
function Dialog({ title, onClose, children, className = '' }: { title: string; onClose: () => void; children: ReactNode; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const el = dialog.current; el?.showModal(); return () => el?.close(); }, []);
  return <dialog ref={dialog} className={`grimoireDialog paper ${className}`} onCancel={e => { e.preventDefault(); onClose(); }} aria-label={title}>
    <header className="dialogHeader"><h2>{title}</h2><button className="iconButton" aria-label={`${title} 닫기`} onClick={onClose}>×</button></header>{children}
  </dialog>;
}
type BoardProps = { full?: boolean; players: Player[]; step: number; choosing: boolean; targets: number[]; inspected: number | null; onTarget: (id: number) => void; onInspect: (id: number) => void; onExpand: () => void };
function Board({ full = false, players, step, choosing, targets, inspected, onTarget, onInspect, onExpand }: BoardProps) {
    const sideCount = Math.ceil((players.length - 4) / 2);
    const rightCount = Math.ceil((players.length - 4) / 2);
    const position = (index: number) => {
      if (index < 2) return { x: 35 + index * 30, y: 9 };
      if (index < 2 + rightCount) return { x: 86, y: 24 + (index - 2) * 54 / Math.max(1, sideCount - 1) };
      if (index < 4 + rightCount) return { x: 65 - (index - 2 - rightCount) * 30, y: 93 };
      return { x: 14, y: 78 - (index - 4 - rightCount) * 54 / Math.max(1, players.length - 5 - rightCount) };
    };
    return <section className={`seatingLeaf paper ${full ? 'fullBoard' : ''}`} aria-label="마도서 배치">
      <header className="leafMasthead"><span>THE GRIMOIRE</span><span>이야기꾼 전용</span></header>
      <div className="boardTitle"><h2>마을의 배치</h2><span><b>{players.filter(p => p.alive).length}</b> 생존 <i>/</i> {players.length}명</span></div>
      <div className="seatingBoard" style={{ '--board-height': players.length > 12 ? '940px' : '590px' } as CSSProperties}>
        <div className="boardCenter"><Sigil/><div><span>제 일 장</span><strong>첫날 밤</strong><small>{choosing ? '대상 두 명 선택' : step < 4 ? `${stepLabels[step]}의 차례` : '전달 완료'}</small>{choosing && <b className="targetCount">{targets.length} / 2</b>}</div></div>
        {players.map((p, i) => { const pos = position(i); const c = character(p.role); const isActor = step === 0 ? p.id === 2 || p.id === 3 : actorIds[step] === p.id; return <button key={p.id} className={`seat ${isActor ? 'isActor' : ''} ${targets.includes(p.id) && step === 3 ? 'isTarget' : ''} ${!p.alive ? 'isDead' : ''}`} style={{ left: `${pos.x}%`, top: `${pos.y}%` }} aria-label={`${p.id}번 ${p.name}, ${c.label}${isActor ? ', 현재 행동자' : ''}${!p.alive ? ', 사망' : ''}`} aria-pressed={choosing ? targets.includes(p.id) : inspected === p.id} disabled={choosing && targets.length === 2 && !targets.includes(p.id)} onClick={() => choosing ? onTarget(p.id) : onInspect(p.id)}>
          <span className="seatToken"><img src={c.image} alt=""/><span className="seatNumber">{p.id.toString().padStart(2, '0')}</span>{!p.alive && <span className="deathMark" aria-label="사망">×</span>}{choosing && targets.includes(p.id) && <span className="targetMark">✓</span>}</span>
          <strong>{p.name || `${p.id}번`}</strong><span className={`seatRole ${c.kind === 'Demon' || c.kind === 'Minion' ? 'evilRole' : ''}`}>{c.label}</span>
          {p.tokens.length > 0 && <span className="seatTokens">{p.tokens.map(t => <small key={t}>{t}</small>)}</span>}
        </button>; })}
      </div>
      <footer className="boardFooter"><span><i className="actorDot"/> 현재 행동자</span><span>✧ {players.reduce((n, p) => n + p.tokens.length, 0)} 토큰</span>{!full && <button onClick={onExpand}>배치 펼치기 ↗</button>}</footer>
    </section>;
  }

function StoryConsole() {
  const [view, setView] = useState<View>('story');
  const [players, setPlayers] = useState(makePlayers);
  const [step, setStep] = useState(0);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [bluffs, setBluffs] = useState<string[]>([]);
  const [targets, setTargets] = useState<number[]>([]);
  const [result, setResult] = useState('');
  const [chefNumber, setChefNumber] = useState(1);
  const [sheet, setSheet] = useState(false);
  const [inspected, setInspected] = useState<number | null>(null);
  const [disclosure, setDisclosure] = useState<Disclosure | null>(null);
  const [covered, setCovered] = useState(false);
  const [history, setHistory] = useState(false);
  const [undo, setUndo] = useState(false);
  const [review, setReview] = useState(false);
  const [notice, setNotice] = useState('');
  const [slot, setSlot] = useState<{ time: string; snapshot: Snapshot } | null>(null);
  const [file, setFile] = useState<Snapshot | null>(null);
  const [pendingLoad, setPendingLoad] = useState<Snapshot | null>(null);
  const [savedAt, setSavedAt] = useState('');
  const [changed, setChanged] = useState(false);
  const scrollPositions = useRef<Record<View, number>>({ story: 0, seating: 0, storage: 0 });
  const current = useRef<HTMLElement>(null);
  const revealHeading = useRef<HTMLHeadingElement>(null);
  const advanceAfterReveal = useRef(false);
  const selectedPlayer = players.find(p => p.id === inspected);
  const actor = players.find(p => p.id === actorIds[step]);
  const choosing = step === 3 && !history && view !== 'storage';
  const lastEntry = entries.at(-1);
  useEffect(() => { if (disclosure) revealHeading.current?.focus(); }, [disclosure, covered]);
  useEffect(() => { if (!notice) return; const id = window.setTimeout(() => setNotice(''), 4200); return () => window.clearTimeout(id); }, [notice]);
  useEffect(() => { if (!disclosure) requestAnimationFrame(() => { if (advanceAfterReveal.current) { current.current?.focus({ preventScroll: true }); current.current?.scrollIntoView({ block: 'center', behavior: 'instant' }); advanceAfterReveal.current = false; } else window.scrollTo({ top: scrollPositions.current[view], behavior: 'instant' }); }); }, [view, disclosure]);
  const snapshot = (): Snapshot => structuredClone({ players, step, entries, bluffs, targets, result, chefNumber });
  function restore(value: Snapshot) { const s = structuredClone(value); setPlayers(s.players); setStep(s.step); setEntries(s.entries); setBluffs(s.bluffs); setTargets(s.targets); setResult(s.result); setChefNumber(s.chefNumber); setHistory(false); setInspected(null); setSheet(false); setChanged(false); }
  function navigate(next: View) { scrollPositions.current[view] = window.scrollY; setView(next); setSheet(false); setNotice(''); }
  function markChanged() { setChanged(true); }
  function updatePlayer(id: number, values: Partial<Player>) { setPlayers(list => list.map(p => p.id === id ? { ...p, ...values } : p)); markChanged(); }
  function selectTarget(id: number) { setTargets(list => list.includes(id) ? list.filter(x => x !== id) : list.length < 2 ? [...list, id] : list); markChanged(); }
  function openDisclosure(value: Disclosure) { scrollPositions.current[view] = window.scrollY; setSheet(false); setInspected(null); setReview(false); setCovered(false); setDisclosure(value); }
  function finishDisclosure() { if (disclosure?.entry) { advanceAfterReveal.current = true; setEntries(list => [...list, disclosure.entry!]); setStep(disclosure.entry.step + 1); markChanged(); } setDisclosure(null); setCovered(false); }
  function makeEntry(): Entry {
    const p = actor!; const name = p.name || `${p.id}번`; const role = character(p.role).label;
    if (step === 0) return { step, title: '하수인 정보 전달', actor: players.filter(x => x.id === 2 || x.id === 3).map(x => x.name).join(' · '), role: '하수인', text: '눈을 뜨고 악마를 확인했다.', result: `악마 · ${players[0].name}`, revealTitle: '당신의 악마', revealText: `${players[0].id}번 ${players[0].name}`, bluffs: [] };
    if (step === 1) return { step, title: '악마 정보 전달', actor: name, role, text: '하수인과 세 가지 속임수를 확인했다.', result: bluffs.map(id => character(id).label).join(' · '), revealTitle: '당신의 하수인', revealText: players.filter(x => x.id === 2 || x.id === 3).map(x => `${x.id}번 ${x.name}`).join(' · '), bluffs: [...bluffs] };
    if (step === 2) return { step, title: '요리사 정보 전달', actor: name, role, text: '이웃한 악한 플레이어의 쌍을 확인했다.', result: `${chefNumber}쌍`, revealTitle: '이웃한 악한 플레이어', revealText: `${chefNumber}쌍`, bluffs: [] };
    return { step, title: '점쟁이 정보 전달', actor: name, role, text: `${targets.map(id => players.find(x => x.id === id)!.name).join(' · ')}${particle(players.find(x => x.id === targets.at(-1))!.name, '을', '를')} 선택했다.`, result, revealTitle: '선택한 두 사람 중에 악마가 있습니까?', revealText: result, bluffs: [] };
  }
  function discloseCurrent() { const entry = makeEntry(); openDisclosure({ title: entry.revealTitle, text: entry.revealText, bluffs: entry.bluffs, entry }); }
  function showHistory() { setHistory(true); setView('story'); requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'instant' })); }
  function returnCurrent() { setHistory(false); setView('story'); requestAnimationFrame(() => current.current?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })); }
  function reset(stress = false) { restore({ players: stress ? makeStressPlayers() : makePlayers(), step: 0, entries: [], bluffs: [], targets: [], result: '', chefNumber: 1 }); setView('story'); setSlot(null); setFile(null); setSavedAt(''); setReview(false); scrollPositions.current = { story: 0, seating: 0, storage: 0 }; window.scrollTo(0, 0); }
  function saveDevice() { const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }); setSlot({ time, snapshot: snapshot() }); setSavedAt(time); setChanged(false); setNotice('기기 저장 완료 · 시안에서만 유지됩니다.'); }
  function undoLast() { if (!lastEntry) return; setStep(lastEntry.step); setEntries(list => list.slice(0, -1)); setUndo(false); markChanged(); setNotice(`${lastEntry.title} 기록을 되돌렸습니다.`); returnCurrent(); }
  function person(id: number) { const p = players.find(x => x.id === id)!; return <button className="personLink" onClick={() => setInspected(id)}>{p.name || `${id}번`}</button>; }
  const boardProps = { players, step, choosing, targets, inspected, onTarget: selectTarget, onInspect: setInspected, onExpand: () => navigate('seating') };
  if (disclosure) return <div className="disclosureRoot"><main className={`disclosurePaper paper ${covered ? 'isCovered' : ''}`} aria-label="플레이어 공개 화면">
    <header className="leafMasthead"><span>THE WHISPER</span><span>밤의 속삭임</span></header>
    <div className="disclosureContent">{covered ? <><div className="coveredEye"><Eye closed/></div><p className="eyebrow">기록을 덮었습니다</p><h1 ref={revealHeading} tabIndex={-1}>비밀은 다시<br/>어둠 속으로.</h1></> : <><Sigil className="disclosureSigil"/><p className="eyebrow">{disclosure.title}</p><h1 ref={revealHeading} tabIndex={-1}>{disclosure.text}</h1>{disclosure.bluffs.length > 0 && <div className="disclosureBluffs"><p>이 배역들은 게임에 없습니다.</p><div>{disclosure.bluffs.map(id => <figure key={id}><img src={character(id).image} alt=""/><figcaption>{character(id).label}</figcaption></figure>)}</div></div>}</>}</div>
    <footer className="disclosureActions">{covered ? <><button className="textButton" onClick={() => setCovered(false)}>다시 펼치기</button><button className="inkButton" onClick={finishDisclosure}>{disclosure.entry ? '전달 완료 · 기록으로' : '이야기꾼 화면으로'} ↵</button></> : <button className="inkButton" onClick={() => setCovered(true)}><Eye/> 정보 가리기</button>}</footer>
  </main></div>;
  return <div className="grimoireRoot">
    <header className="consoleHeader"><a className="bookIdentity" href="#" onClick={e => { e.preventDefault(); navigate('story'); }}><Sigil/><span><small>STORYTELLER’S GRIMOIRE</small><strong>등불 아래의 속삭임</strong></span></a><nav aria-label="마도서 화면">{([['story', '진행'], ['seating', '배치'], ['storage', '저장']] as const).map(([id, label]) => <button key={id} aria-current={view === id ? 'page' : undefined} onClick={() => navigate(id)}>{label}</button>)}</nav><span className="headerPhase"><i/>첫날 밤</span></header>
    {(view === 'storage' || (view === 'story' && history)) && <aside className="reviewContext" aria-label="시안 검토 안내"><span>#218 · 검토 안내</span><p>{view === 'storage' ? '저장·불러오기 동작을 체험하는 시안입니다. 실제 파일과 기기 저장소에는 기록하지 않으며 새로고침하면 초기화됩니다.' : '첫날 밤 이후의 장은 기록 탐색을 위한 예시입니다. 현재 게임의 진행과 연결되지 않습니다.'}</p></aside>}
    <main>
      <div hidden={view !== 'story'} className="spread">
        <aside className="desktopSeating"><Board {...boardProps}/></aside>
        <section className="chronicleLeaf paper" aria-label="진행과 기록">
          <header className="leafMasthead"><span>THE CHRONICLE</span><button className="textButton" aria-expanded={history} onClick={() => history ? returnCurrent() : showHistory()}>{history ? '현재 진행으로 ↵' : '기록 목차 ☷'}</button></header>
          {history ? <div className="archive"><div className="chapterHeading"><span className="eyebrow">지난 장을 펼치다</span><h1>밤과 낮의 기록</h1></div><button className="currentBookmark" onClick={returnCurrent}>Ⅰ 첫날 밤 <span>현재 진행으로 ↵</span></button>{archive.map(chapter => <details key={chapter.number} open><summary><span>{chapter.number}</span>{chapter.title}<small>{chapter.rows.length}개의 기록</small></summary>{chapter.rows.map(([who, text, outcome], i) => <article key={i} className="archiveEntry"><strong>{who}</strong><p>{text}</p><span>{outcome}</span></article>)}</details>)}<button className="inkButton" onClick={returnCurrent}>현재 진행으로 ↵</button></div> : <>
            <div className="chapterHeading"><span className="eyebrow">제 일 장 <span className="chapterRule"/> I</span><h1>첫날 밤</h1><p>등불이 꺼지고, 비밀이 눈을 뜬다.</p></div>
            <ol className="nightOrder" aria-label="예시 진행 순서">{stepLabels.map((label, i) => <li key={label} className={i === step ? 'current' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}><span>{i < step ? '✓' : `0${i + 1}`}</span>{label}</li>)}</ol>
            <div className="storyBody">
              {entries.map(entry => <article key={entry.step} className="writtenEntry"><div className="entryOrdinal">0{entry.step + 1}<span>✓</span></div><div><div className="entryLabel">{entry.role} <span>전달 완료</span></div><p><strong>{entry.actor}</strong>{entry.step === 0 ? particle(entry.actor, '이 ', '가 ') : particle(entry.actor, '은 ', '는 ')}{entry.text}</p><p className="entryResult">{entry.result}</p><button className="textButton" onClick={() => openDisclosure({ title: entry.revealTitle, text: entry.revealText, bluffs: entry.bluffs })}>전달한 정보 보기 ↗</button></div></article>)}
              <section ref={current} tabIndex={-1} className="currentPassage" aria-label="현재 진행"><div className="passageHeading"><span className="inkDiamond">◆</span><span>{step < 4 ? `0${step + 1} · 지금 기록하는 문단` : '이 장의 마지막 기록'}</span></div>
                {step === 0 && <><div className="actorHeading"><span className="roleInscription">하수인</span><span className="redRule"/></div><p className="narrative">{person(2)}{particle(players[1].name, '과', '와')} {person(3)}{particle(players[2].name, '이', '가')} 눈을 뜨고,<br className="desktopBreak"/> 어둠 속에서 악마를 찾는다.</p><div className="whisperPreview"><Eye/><span>악마</span>{person(1)}<small>{character(players[0].role).label}</small></div></>}
                {step === 1 && <><div className="actorHeading"><span className="roleInscription">악마</span><img src={character(actor!.role).image} alt=""/></div><p className="narrative">{person(1)}에게 하수인과<br/>세 가지 속임수를 알려준다.</p><div className="selectionHeader"><span>속임수 선택</span><b>{bluffs.length} / 3</b></div><div className="bluffGrid" role="group" aria-label="속임수 배역 선택">{bluffOptions.map(c => <button key={c.id} aria-pressed={bluffs.includes(c.id)} disabled={bluffs.length === 3 && !bluffs.includes(c.id)} onClick={() => { setBluffs(list => list.includes(c.id) ? list.filter(id => id !== c.id) : [...list, c.id]); markChanged(); }}><span><img src={c.image} alt=""/>{bluffs.includes(c.id) && <b>✓</b>}</span>{c.label}</button>)}</div></>}
                {step === 2 && <><div className="actorHeading"><span className="roleInscription">{character(actor!.role).label}</span><img src={character(actor!.role).image} alt=""/></div><p className="narrative">{person(4)}{particle(players[3].name, '이', '가')} 눈을 뜬다.<br/>이웃한 악한 이들은 몇 쌍인가.</p><div className="numberInput"><button aria-label="쌍 수 줄이기" disabled={chefNumber === 0} onClick={() => { setChefNumber(v => v - 1); markChanged(); }}>−</button><output aria-label="전달할 쌍 수">{chefNumber}<small>쌍</small></output><button aria-label="쌍 수 늘리기" disabled={chefNumber === players.length} onClick={() => { setChefNumber(v => v + 1); markChanged(); }}>+</button></div><p className="inputHint">이야기꾼이 전달할 수를 정합니다.</p></>}
                {step === 3 && <><div className="actorHeading"><span className="roleInscription">{character(actor!.role).label}</span><img src={character(actor!.role).image} alt=""/></div><p className="narrative">{person(5)}{particle(players[4].name, '이', '가')} 두 사람의<br/>운명을 들여다본다.</p><div className="selectionHeader"><span>대상 두 명</span><b>{targets.length} / 2</b></div><div className="chosenTargets">{[0, 1].map(i => <button key={i} className={targets[i] ? 'hasTarget' : ''} aria-label={targets[i] ? `${players.find(p => p.id === targets[i])!.name} 선택 해제` : `대상 ${i + 1} 선택`} onClick={() => targets[i] ? selectTarget(targets[i]) : setSheet(true)}>{targets[i] ? <><img src={character(players.find(p => p.id === targets[i])!.role).image} alt=""/><strong>{players.find(p => p.id === targets[i])!.name}</strong><span>×</span></> : <><span>＋</span>배치에서 선택</>}</button>)}</div><fieldset className="resultChoices"><legend>전달할 결과</legend>{['예', '아니오'].map(r => <button type="button" key={r} aria-pressed={result === r} onClick={() => { setResult(r); markChanged(); }}>{r}</button>)}</fieldset></>}
                {step === 4 && <div className="chapterComplete"><Sigil/><h2>비밀이 기록되었다.</h2><p>네 번의 전달이 마도서에 남았습니다.</p><button className="textButton" onClick={() => navigate('storage')}>기록 저장하기 ↗</button><small>이번 시안은 첫날 밤의 대표 행동까지 이어집니다.</small></div>}
                <div className="passageActions">{entries.length > 0 && <button className="textButton undoAction" onClick={() => setUndo(true)}>↶ 되돌리기</button>}{step < 4 && <button className="inkButton" onClick={discloseCurrent} disabled={(step === 1 && bluffs.length !== 3) || (step === 3 && (targets.length !== 2 || !result))}><Eye/>{step === 0 ? '악마 알려주기' : step === 1 ? '하수인과 속임수 공개' : '정보 공개'}<span>↗</span></button>}</div>
              </section>
              {step < 3 && <div className="nextPassage"><span>다음 기록</span><strong>{stepLabels[step + 1]}</strong><span>──── ✧</span></div>}
            </div>
          </>}
          <footer className="leafFolio"><span>등불 아래의 속삭임</span><span>— {history ? '목차' : '01'} —</span></footer>
        </section>
      </div>
      <section hidden={view !== 'seating'} className="standaloneBoard"><div className="standaloneHeading"><div><span className="eyebrow">THE GRIMOIRE</span><h1>배치를 펼치다</h1></div><button className="darkTextButton" onClick={() => navigate('story')}>진행으로 돌아가기 ↵</button></div><Board {...boardProps} full/>{choosing && <div className="standaloneSelection"><span>{actor?.name} · {character(actor?.role ?? 'fortuneTeller').label} · 대상 {targets.length} / 2</span><button className="inkButton" onClick={() => navigate('story')}>진행으로 ↵</button></div>}</section>
      <section hidden={view !== 'storage'} className="storageLeaf paper" aria-label="저장 화면"><header className="leafMasthead"><span>THE ARCHIVE</span><span>기록 보관</span></header><div className="chapterHeading"><span className="eyebrow">책을 덮기 전에</span><h1>기록을 보관하다</h1><p>등불 아래의 속삭임 · 첫날 밤</p></div><div className="storageSummary"><Sigil/><div><strong>{players.length}명의 이름, {entries.length}개의 기록</strong><p>{savedAt ? `${savedAt} 저장${changed ? ' · 이후 변경 있음' : ''}` : '아직 저장하지 않은 기록'}</p></div></div><div className="storageColumns"><section><span className="eyebrow">I · 이 기기</span><h2>기기에 저장</h2><p>현재 배치와 진행을 보관합니다.</p><button className="inkButton" onClick={saveDevice}>기기에 저장 ↓</button><div className="savedSlot"><span>{slot ? '등불 아래의 속삭임' : '보관된 기록 없음'}</span>{slot && <><small>첫날 밤 · {slot.snapshot.entries.length}개의 기록 · {slot.time}</small><button className="textButton" onClick={() => setPendingLoad(slot.snapshot)}>이 기록 불러오기 ↗</button></>}</div></section><section><span className="eyebrow">II · 파일</span><h2>파일로 보관</h2><p>게임 기록을 파일로 옮깁니다.</p><button className="outlineButton" onClick={() => { setFile(snapshot()); setNotice('파일 저장 화면을 확인했습니다. 실제 파일은 생성하지 않습니다.'); }}>파일로 저장 ↓</button><button className="textButton fileLoad" disabled={!file} onClick={() => file && setPendingLoad(file)}>파일 불러오기 ↗</button></section></div><footer className="leafFolio"><button className="textButton" onClick={() => navigate('story')}>진행으로 돌아가기 ↵</button><span>— 보관 —</span></footer></section>
    </main>
    <footer className="reviewFooter"><span>#218 <i/> 마도서 콘솔 시안</span><button onClick={() => setReview(true)}>검토 도구 ↗</button></footer>
    {view === 'story' && <button className="paperTab" aria-expanded={sheet} onClick={() => setSheet(true)}><span className="tabStitch"/><span>✧ 배치</span><small>{choosing ? `${targets.length} / 2 선택` : `${players.length}명`}</small><b>⌃</b></button>}
    {sheet && <Dialog title="마도서 배치" onClose={() => setSheet(false)} className="mobileSheet"><div className="sheetContext"><span>{step < 4 ? `${actor?.name} · ${stepLabels[step]}` : '첫날 밤 · 전달 완료'}</span><strong>{choosing ? `대상 ${targets.length} / 2` : `${players.length}명`}</strong></div><Board {...boardProps} full/><footer className="sheetActions"><button className="inkButton" onClick={() => setSheet(false)}>{choosing ? '선택한 대상으로 돌아가기' : '배치 종이 넣기'} ↓</button></footer></Dialog>}
    {selectedPlayer && <Dialog title="플레이어 기록" onClose={() => setInspected(null)} className="playerDialog"><div className="playerIdentity"><img src={character(selectedPlayer.role).image} alt=""/><div><span className="eyebrow">SEAT {String(selectedPlayer.id).padStart(2, '0')}</span><h3>{selectedPlayer.name || `${selectedPlayer.id}번`}</h3><span>{character(selectedPlayer.role).label}</span></div></div><label className="fieldLabel">이름<input maxLength={30} value={selectedPlayer.name} onChange={e => updatePlayer(selectedPlayer.id, { name: e.target.value })}/></label><label className="fieldLabel">배역<select value={selectedPlayer.role} onChange={e => updatePlayer(selectedPlayer.id, { role: e.target.value })}>{catalog.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label><div className="statusToggle"><span>생사</span><button aria-pressed={selectedPlayer.alive} onClick={() => updatePlayer(selectedPlayer.id, { alive: true })}>○ 생존</button><button aria-pressed={!selectedPlayer.alive} onClick={() => updatePlayer(selectedPlayer.id, { alive: false })}>× 사망</button></div><fieldset className="tokenEditor"><legend>토큰</legend>{['중독', '취함', '보호', '위장', '사용함'].map(t => <button key={t} aria-pressed={selectedPlayer.tokens.includes(t)} onClick={() => updatePlayer(selectedPlayer.id, { tokens: selectedPlayer.tokens.includes(t) ? selectedPlayer.tokens.filter(x => x !== t) : [...selectedPlayer.tokens, t] })}>{selectedPlayer.tokens.includes(t) ? '✓ ' : '+ '}{t}</button>)}</fieldset><label className="fieldLabel">이야기꾼 메모<textarea rows={3} value={selectedPlayer.note} placeholder="이 인물에 관한 기록" onChange={e => updatePlayer(selectedPlayer.id, { note: e.target.value })}/></label><p className="inputHint">이전 기록에는 당시 이름과 배역이 남습니다.</p><div className="dialogActions"><button className="inkButton" onClick={() => setInspected(null)}>기록 닫기 ↵</button></div></Dialog>}
    {undo && lastEntry && <Dialog title="마지막 기록 되돌리기" onClose={() => setUndo(false)}><p className="dialogCopy"><strong>{lastEntry.actor} · {lastEntry.role}</strong><br/>{lastEntry.text}</p><div className="undoPreview"><span>삭제할 기록</span><strong>{lastEntry.title} · {lastEntry.result}</strong><span>돌아갈 진행</span><strong>{stepLabels[lastEntry.step]} · 정보 전달 전</strong></div><p className="inputHint">배치와 입력한 선택은 유지됩니다. 플레이어에게 전달한 정보는 회수할 수 없습니다.</p><div className="dialogActions"><button className="textButton" onClick={() => setUndo(false)}>취소</button><button className="inkButton" onClick={undoLast}>기록 되돌리기 ↶</button></div></Dialog>}
    {pendingLoad && <Dialog title="보관한 기록 불러오기" onClose={() => setPendingLoad(null)}><p className="dialogCopy">현재 배치와 진행을 보관한 기록으로 바꿉니다.</p><div className="undoPreview"><span>현재</span><strong>{players.length}명 · {entries.length}개의 기록</strong><span>불러올 기록</span><strong>{pendingLoad.players.length}명 · {pendingLoad.entries.length}개의 기록</strong></div><div className="dialogActions"><button className="textButton" onClick={() => setPendingLoad(null)}>취소</button><button className="inkButton" onClick={() => { restore(pendingLoad); setPendingLoad(null); setSavedAt(pendingLoad === slot?.snapshot ? slot.time : ''); setNotice('예시 기록을 불러왔습니다.'); }}>불러오기 ↵</button></div></Dialog>}
    {review && <Dialog title="#218 · 시안 검토" onClose={() => setReview(false)} className="reviewDialog"><p className="dialogCopy">배치 · 진행 · 기록 · 공개 · 저장의 연결을 검토합니다.</p><p>실제 게임과 규칙 판정은 연결하지 않았습니다. 첫날 밤의 대표 행동 네 가지와 별도의 기록 탐색 예시를 사용합니다.</p><div className="reviewButtons"><button className="outlineButton" onClick={() => reset()}>12명 · 처음부터</button><button className="outlineButton" onClick={() => reset(true)}>15명 · 긴 이름과 토큰</button><button className="outlineButton" onClick={() => { setStep(3); setTargets([]); setResult(''); setEntries([]); setHistory(false); setView('story'); setReview(false); markChanged(); }}>대상 선택 바로 보기</button><button className="outlineButton" onClick={() => { showHistory(); setReview(false); }}>긴 기록 탐색</button></div></Dialog>}
    {notice && <div role="status" className="notice">{notice}</div>}
  </div>;
}
const root = createRoot(document.getElementById('root')!); root.render(<StoryConsole/>);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
