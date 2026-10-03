import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { cast } from './cast';
import { useWide } from './reviewKit';
import { SpeakingPlaza, type SpeakingMessage, type SpeakingNotice, type SpeakingView, type SquareVariant } from './SpeakingPlaza';
import { useMobileViewport } from './useMobileViewport';
import { PlazaTimer, timerSnapshot } from './PlazaTimer';
import type { WhisperArrival } from './WhisperAction';
import './review.css';

const incoming = [
  { seat: 7, text: '서연, 어젯밤 정보도 알려 줄 수 있어?' },
  { seat: 2, text: '첫날이랑 숫자가 달라졌는지가 궁금해.' },
  { seat: 6, text: '정보부터 듣고 지명하자. 아직 시간 있어.' },
];

type WhisperThread = { messages: SpeakingMessage[]; unread: number };
const initialWhispers = (): Record<number, WhisperThread> => ({
  7: { messages: [
    { id: 20, seat: 7, text: '어젯밤 정보에 대해 잠깐 이야기할 수 있어?' },
    { id: 21, seat: 7, text: '나는 첫날과 같은 숫자를 받았어.' },
  ], unread: 2 },
  2: { messages: [{ id: 22, seat: 2, text: '지명 전에 확인하고 싶은 게 있어.' }], unread: 1 },
});

const noticeReview = location.pathname.endsWith('issue-294-notices.html');
const timerReview = location.pathname.endsWith('issue-294-timer.html');
const guessReview = location.pathname.endsWith('issue-294-guesses.html');
const squareReview = location.pathname.endsWith('issue-294-square.html');
const liveTimer = timerReview || guessReview || squareReview;
const reviewNumber = squareReview ? '05' : guessReview ? '04' : timerReview ? '03' : noticeReview ? '02' : '01';
const reviewTitle = squareReview ? '광장 뒷줄 가독성' : guessReview ? '상대 직업 추측' : timerReview ? '남은 시간' : noticeReview ? '공지 전달 방식' : '말하기 중 화면';
const shortNotice = '잠시 후 지명을 받겠습니다.';
const longNotice = '오늘은 지명을 받기 전에 각자 받은 정보를 짧게 이야기해 주세요. 귓속말 중인 분들도 광장으로 돌아와서 함께 들어 주세요.';
const noticeTime = (at = Date.now()) => new Intl.DateTimeFormat('ko', { hour: '2-digit', minute: '2-digit', hour12: false }).format(at);
const initialNotices = (): SpeakingNotice[] => noticeReview || liveTimer ? [
  { id: 1, text: '토론을 시작합니다.', at: noticeTime(Date.now() - 180000), read: true },
  { id: 2, text: '첫 지명 전까지 자유롭게 이야기해 주세요.', at: noticeTime(Date.now() - 120000), read: true },
] : [];

function App() {
  const wide = useWide();
  const viewportRef = useMobileViewport(!wide);
  const params = new URLSearchParams(location.search);
  const [count, setCount] = useState<8 | 15>(params.get('n') === '15' ? 15 : 8);
  const [panelOpen, setPanelOpen] = useState(false);
  const [squareVariant, setSquareVariant] = useState<SquareVariant>(() => {
    const v = params.get('layout');
    return v === 'original' || v === 'readable' || v === 'flat' ? v : 'soft';
  });
  const [keyboard, setKeyboard] = useState(true);
  const [auto, setAuto] = useState(!liveTimer);
  const [timer, setTimer] = useState(() => timerSnapshot());
  const [round, setRound] = useState(0);
  const [roleGuesses, setRoleGuesses] = useState<Record<number, string>>({});
  const [draft, setDraft] = useState('');
  const [composing, setComposing] = useState(false);
  const [view, setView] = useState<SpeakingView>({ kind: 'public', seat: null });
  const [whispers, setWhispers] = useState<Record<number, WhisperThread>>(initialWhispers);
  const [whisperArrival, setWhisperArrival] = useState<WhisperArrival | null>(null);
  const [whisperDrafts, setWhisperDrafts] = useState<Record<number, string>>({});
  const c = useMemo(() => cast(count), [count]);
  const [messages, setMessages] = useState<SpeakingMessage[]>(() => cast(count).feed.map((m, id) => ({ ...m, id })));
  const [notices, setNotices] = useState<SpeakingNotice[]>(initialNotices);
  const nextId = useRef(100);
  const incomingIndex = useRef(0);
  const started = useRef(false);
  const timers = useRef<number[]>([]);
  const [scheduled, setScheduled] = useState(false);
  const nextPublicSendAt = useRef(0);
  const [publicSendAvailableAt, setPublicSendAvailableAt] = useState(0);
  const readingConversation = useRef({ composing, view });
  useLayoutEffect(() => { readingConversation.current = { composing, view }; }, [composing, view]);

  useEffect(() => {
    const url = new URL(location.href);
    url.searchParams.set('mode', squareReview ? 'square' : guessReview ? 'guesses' : timerReview ? 'timer' : noticeReview ? 'notices' : 'conversation');
    url.searchParams.set('n', String(count));
    if (squareReview) url.searchParams.set('layout', squareVariant);
    history.replaceState(null, '', url);
  }, [count, squareVariant]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const addIncoming = () => {
    const line = incoming[incomingIndex.current++ % incoming.length];
    const message = { ...line, id: nextId.current++ };
    setMessages((m) => [...m, message]);
  };
  const addWhisper = useCallback((seat: number) => {
    const message = { id: nextId.current++, seat, text: '받은 정보가 하나 더 있어. 잠깐 이야기할 수 있어?' };
    // Delayed fixtures must use the conversation open at arrival, not at scheduling.
    const { composing, view } = readingConversation.current;
    const reading = composing && view.kind === 'whisper' && view.seat === seat;
    setWhispers((all) => ({ ...all, [seat]: {
      messages: [...(all[seat]?.messages ?? []), message],
      unread: reading ? 0 : (all[seat]?.unread ?? 0) + 1,
    } }));
    if (!reading) setWhisperArrival({ id: message.id, seat, name: c.players.find((person) => person.seat === seat)!.name, at: Date.now() });
  }, [c]);
  const previewWhisper = (seat: number, delay = 0) => {
    if (!wide) setPanelOpen(false);
    if (delay) timers.current.push(window.setTimeout(() => addWhisper(seat), delay));
    else addWhisper(seat);
  };
  const readWhisper = (seat: number) => setWhispers((all) => all[seat]?.unread
    ? { ...all, [seat]: { ...all[seat], unread: 0 } }
    : all);
  const addNotice = useCallback((text = shortNotice) => {
    const notice: SpeakingNotice = { id: nextId.current++, text, at: noticeTime(), read: false };
    setNotices((all) => [...all, notice]);
  }, []);
  const readNotices = useCallback(() => setNotices((all) => all.some((notice) => !notice.read) ? all.map((notice) => ({ ...notice, read: true })) : all), []);
  const previewNotice = (text = shortNotice) => {
    if (!wide) setPanelOpen(false);
    addNotice(text);
  };
  const addNoticeBurst = () => {
    if (!wide) setPanelOpen(false);
    ['모두 광장으로 모여 주세요.', '받은 정보를 짧게 이야기해 주세요.', '지금부터 지명을 받겠습니다.'].forEach((text, index) => {
      if (index === 0) addNotice(text);
      else timers.current.push(window.setTimeout(() => addNotice(text), index * 900));
    });
  };
  useEffect(() => {
    if (!noticeReview) return;
    if (!auto) { setScheduled(false); return; }
    setScheduled(true);
    const timer = window.setTimeout(() => { addNotice(); setScheduled(false); }, 2000);
    timers.current.push(timer);
    return () => window.clearTimeout(timer);
  }, [round, auto, addNotice]);
  const begin = () => {
    if (liveTimer || noticeReview || !auto || started.current) return;
    started.current = true;
    setScheduled(true);
    timers.current = [window.setTimeout(addIncoming, 5000), window.setTimeout(() => { addNotice(); setScheduled(false); }, 10000)];
  };
  const reset = (n = count) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    started.current = false;
    incomingIndex.current = 0;
    nextId.current = 100;
    setScheduled(false);
    setNotices(initialNotices());
    setDraft('');
    setComposing(false);
    setView({ kind: 'public', seat: null });
    setWhispers(initialWhispers());
    setWhisperArrival(null);
    setWhisperDrafts({});
    nextPublicSendAt.current = 0;
    setPublicSendAvailableAt(0);
    setTimer(timerSnapshot());
    setRoleGuesses({});
    setMessages(cast(n).feed.map((m, id) => ({ ...m, id })));
    setRound((r) => r + 1);
    setCount(n);
    setPanelOpen(false);
  };
  const preserveFocus = (e: React.PointerEvent) => { if (wide && e.pointerType === 'mouse') e.preventDefault(); };
  const previewTimer = (seconds: number) => {
    setTimer((current) => timerSnapshot(seconds, current.revision + 1));
    if (!wide) setPanelOpen(false);
  };
  const extendTimer = () => {
    setTimer((current) => ({ deadline: Math.max(Date.now(), current.deadline) + 60000, duration: current.duration + 60, revision: current.revision + 1, added: true }));
    if (!wide) setPanelOpen(false);
  };
  const controls = <>
    {squareReview && <>
      <section className="rv-notes"><h2>이번 검토 · 뒷줄 가독성</h2><p>원래 광장의 모습과 머리 위 말풍선은 그대로 두고, 원근만 줄여 뒷줄 사람과 이름을 키웁니다. 광장을 세로로 조금 늘려 앞뒤 줄 간격을 확보합니다.</p></section>
      <section><h2>배치 비교</h2><div className="rv-events">
        {([['original', 'A · 원래 광장'], ['soft', 'C · 원근 완화 (뒷줄 0.86배)'], ['flat', 'D · 원근 최소 (뒷줄 0.95배)'], ['readable', 'B · 세로 타원·중앙 말풍선 (보류)']] as [SquareVariant, string][]).map(([v, label]) =>
          <button key={v} type="button" aria-pressed={squareVariant === v} onClick={() => { setSquareVariant(v); setPanelOpen(false); }}>{label}</button>)}
      </div><p className="rv-hint">C·D는 이름표를 인물 크기와 상관없이 같은 크기로 표시합니다. B는 2026-10-03에 보류한 Codex 시안으로, 비교용으로만 남깁니다.</p></section>
      <section><h2>인원 · 변경하면 처음부터</h2><div className="rv-seg">{([8, 15] as const).map((n) => <button key={n} type="button" aria-pressed={count === n} onClick={() => reset(n)}>{n}인</button>)}</div></section>
      <section className="rv-notes"><h2>확인할 흐름</h2><ol className="sp-review-steps"><li>15인에서 A와 C·D의 뒷줄 사람·이름 비교</li><li>말풍선이 말한 사람 머리 위에 붙어 있는지 확인</li><li>8인에서 광장 분위기가 유지되는지 확인</li></ol></section>
    </>}
    {guessReview && <>
      <section className="rv-notes"><h2>이번 검토 · 상대 직업 추측</h2><p>광장 인물을 누른 뒤 이름 옆 ‘직업 추측’을 선택합니다. 고른 직업은 인물 정보와 광장·귓속말 대화의 이름 옆에 아이콘과 함께 표시합니다.</p><p className="rv-hint">상대마다 하나씩 적는 본인용 기록입니다. 직업 목록은 이 시안의 Trouble Brewing 22종입니다. 새로고침하거나 시안을 초기화하면 기록도 지워집니다.</p></section>
      <section className="rv-notes"><h2>확인할 흐름</h2><ol className="sp-review-steps"><li>준호 → 직업 추측 → 악마 → 임프 선택</li><li>광장과 준호의 귓속말에서 이름 옆 직업 확인</li><li>기입한 직업을 변경하거나 지운 뒤 대화 표시 확인</li><li>사망한 사람의 추측과 내 직업 표시 확인</li></ol><p>선택하면 바로 반영합니다. 이름 옆 직업 버튼이나 Esc로 선택 창만 닫을 수 있습니다.</p></section>
    </>}
    <section className="rv-notes"><h2>새 귓속말 도착 · 이번 조정</h2><p>하단 버튼이 진한 청록색으로 바뀌고, 보낸 사람과 ‘새 귓속말’을 6초간 표시합니다. 봉투와 받은 수를 짧게 강조하며, 누르면 해당 대화로 들어갑니다.</p><div className="rv-seg sp-review-events">
      <button type="button" onPointerDown={preserveFocus} onClick={() => previewWhisper(7)}>유나에게서 받기</button>
      <button type="button" onPointerDown={preserveFocus} onClick={() => previewWhisper(2)}>준호에게서 받기</button>
      <button type="button" onPointerDown={preserveFocus} onClick={() => previewWhisper(7, 3000)}>유나 · 3초 뒤 받기</button>
      <button type="button" onPointerDown={preserveFocus} onClick={() => previewWhisper(2, 3000)}>준호 · 3초 뒤 받기</button>
    </div><p className="rv-hint">지금 보고 있는 상대의 메시지는 대화에 바로 표시합니다. 다른 상대의 알림은 초안과 입력 포커스를 유지합니다. 휴대폰에서는 ‘3초 뒤 받기’를 누른 뒤 대화를 작성해 보세요.</p></section>
    {timerReview && <>
      <section className="rv-notes"><h2>이번 검토 · 남은 시간</h2><p>상단 숫자를 키우고, 원형 테두리로 남은 비율을 표시합니다. 1분부터 황금색, 마지막 10초부터 자주색으로 강조합니다. 색이 바뀔 때 테두리가 두 번 퍼집니다.</p></section>
      <section><h2>시간 상태 · 선택하면 흐르기 시작</h2><div className="rv-seg tr-review-presets">
        <button type="button" onPointerDown={preserveFocus} onClick={() => previewTimer(168)}>평상시 · 2:48</button>
        <button type="button" onPointerDown={preserveFocus} onClick={() => previewTimer(60)}>1분 남음</button>
        <button type="button" onPointerDown={preserveFocus} onClick={() => previewTimer(10)}>마지막 10초</button>
        <button type="button" onPointerDown={preserveFocus} onClick={() => previewTimer(0)}>시간 종료</button>
      </div><div className="rv-events"><button type="button" onPointerDown={preserveFocus} onClick={extendTimer}>이야기꾼이 1분 추가</button></div><p className="rv-hint">설정한 토론 시간은 3분입니다. 추가하면 원형 표시에도 반영하고, ‘+1분’을 3초간 표시합니다.</p></section>
      <section className="rv-notes"><h2>확인할 흐름</h2><ol className="sp-review-steps"><li>광장과 대화창에서 남은 시간이 바로 읽히는지</li><li>마지막 10초의 강조가 충분하고 과하지 않은지</li><li>시간 추가와 종료가 명확히 구분되는지</li><li>공지 도착·키보드 사용 중에도 화면이 밀리지 않는지</li></ol><p>종료 시 숫자는 0:00에 멈춥니다. 이 시안에서는 대화를 계속할 수 있습니다.</p></section>
    </>}
    {noticeReview && <section className="rv-notes"><h2>이번 검토 · 공지</h2><p>확성기는 오른쪽 상단에 두고, 직업은 광장에서 나를 누르면 표시합니다. 새 공지는 상단 줄 위에 6초간 펼쳐졌다가 아이콘으로 접힙니다. 누르면 연결된 연한 자주색 이력 창이 펼쳐집니다.</p><p className="rv-hint">자동으로 접혀도 새 공지 수는 남습니다. 이력을 열면 새 공지 표시가 해제됩니다.</p></section>}
    {!liveTimer && <>
    <section><h2>{noticeReview ? '대화창 높이 · 이번 조정' : '채택한 방향 · B'}</h2><p className="rv-hint">대화창이 상단 정보 줄 바로 아래부터 펼쳐집니다. 키보드가 열리면 그 위 공간을 채우고, 좁아진 창에서는 입력칸 높이를 줄여 대화 내용을 확보합니다. 광장은 크림색, 귓속말은 청록색입니다.</p></section>
    <section className="rv-notes"><h2>귓속말 상대</h2><p>작은 정사각형 타일로 모든 상대를 한 번에 표시합니다. 상대별 안 읽은 수는 타일에, 합계는 하단 귓속말 버튼에 표시합니다.</p><p className="rv-hint">검토용으로 유나 2개·준호 1개를 넣었습니다. 해당 대화를 열면 그 상대의 숫자만 사라집니다. 실제 상대에게 전달되지는 않습니다.</p></section>
    </>}
    {!squareReview && <section><h2>인원 · 변경하면 처음부터</h2><div className="rv-seg">{([8, 15] as const).map((n) => <button key={n} type="button" aria-pressed={count === n} onClick={() => reset(n)}>{n}인</button>)}</div></section>}
    <section><h2>검토용 소식</h2>{!liveTimer && <><label className="rv-check"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />{noticeReview ? '페이지를 열면 공지 보내기' : '대화를 처음 열면 소식 보내기'}</label><p className="rv-hint">{noticeReview ? '2초 뒤 공지가 도착합니다.' : '5초 뒤 새 발언, 10초 뒤 공지가 도착합니다.'}</p></>}{scheduled && <p className="rv-pending">소식이 예약되어 있습니다.</p>}<div className="rv-events sp-review-events">
      <button type="button" onPointerDown={preserveFocus} onClick={() => previewNotice()}>공지 보내기</button>
      {noticeReview && <><button type="button" onPointerDown={preserveFocus} onClick={() => previewNotice(longNotice)}>긴 공지 보내기</button><button type="button" onPointerDown={preserveFocus} onClick={addNoticeBurst}>공지 3개 연속 보내기</button></>}
      <button type="button" onPointerDown={preserveFocus} onClick={addIncoming}>새 발언 보내기</button>
    </div></section>
    {wide && <section><label className="rv-check"><input type="checkbox" checked={keyboard} onChange={(e) => setKeyboard(e.target.checked)} />입력창에 포커스하면 키보드 자리 표시</label><p className="rv-hint">휴대폰에서는 실제 키보드로 확인합니다.</p></section>}
    {!liveTimer && (noticeReview ? <section className="rv-notes"><h2>확인할 흐름</h2><ol className="sp-review-steps"><li>작성 중 공지가 와도 입력과 광장이 그대로인지</li><li>한 줄 공지의 주목도와 6초 표시 시간이 적당한지</li><li>접힌 아이콘의 새 공지 수가 눈에 들어오는지</li><li>긴 내용과 연속 공지를 이력에서 확인하기 쉬운지</li></ol><p className="rv-hint">마우스를 올리거나 키보드로 알림에 포커스하면 접힘을 잠시 멈춥니다. 연속 도착 시 한 줄에는 최신 공지를 표시합니다.</p></section>
      : <section className="rv-notes"><h2>대화창 확인</h2><p>버튼의 펼침·접힘, 광장과 귓속말의 색 구분, 전환 시 초안 유지와 배경 고정을 확인합니다.</p></section>)}
    {!noticeReview && !liveTimer && <>
    <section className="rv-notes"><h2>유지한 전송 규칙</h2><ol className="sp-review-steps"><li>Enter 전송 · Shift+Enter 줄바꿈</li><li>한글 조합을 끝내는 Enter에 전송되지 않는지 확인</li><li>보내기 옆 글자 수 · 광장과 귓속말 모두 100자 제한</li><li>광장 전송 후 버튼의 3 → 2 → 1 표시</li><li>기다리며 다음 문장 작성 · 재전송은 3초 뒤</li><li>귓속말에서는 기다림 없이 연속 전송</li></ol><p>3초 쿨타임은 광장에만 적용합니다. 쿨타임 중 Enter를 눌러도 초안이 남고, 시간이 지나면 다시 눌러 전송합니다. 창을 닫거나 귓속말을 오가도 광장 쿨타임은 유지합니다.</p><p className="rv-hint">100자는 공백·줄바꿈을 포함합니다. 긴 내용을 붙여넣으면 앞의 100자까지 입력됩니다.</p></section>
    <section className="rv-notes"><h2>채택한 인물 동작</h2><p>광장 인물에서 발언 모아보기·귓속말 걸기로 진입합니다. 발언을 모아보는 중에도 전송 대상은 광장 전체이며, 전송하면 전체 대화로 돌아옵니다.</p></section>
    <section className="rv-notes"><h2>귓속말 검토 범위</h2><p>상대별 대화창 진입·작성·복귀를 확인하는 로컬 시안입니다. 실제 상대에게 전달되지는 않습니다. 초대·수락과 대화 가능 조건은 후속 검토입니다.</p></section>
    </>}
    <section className="rv-notes"><h2>이어 검토할 것</h2><p>{!liveTimer && '남은 시간 연출, '}{!squareReview && '광장 형태·먼 인물 가독성, '}귓속말 상대 표시. 화면 도움말(?)은 마지막에 검토합니다.</p></section>
    <section><button type="button" className="rv-reset" onClick={() => reset()}>{guessReview || squareReview ? '시안 초기화' : timerReview ? '시간과 대화 초기화' : '작성 내용과 소식 초기화'}</button>
      <a className="sp-original-link" href={squareReview ? './issue-294-guesses.html' : guessReview ? './issue-294-square.html' : timerReview ? './issue-294-guesses.html' : noticeReview ? './issue-294-timer.html' : './issue-294-notices.html'}>{squareReview ? '이전 검토 · 상대 직업 추측 ↗' : guessReview ? '다음 검토 · 광장 뒷줄 가독성 ↗' : timerReview ? '다음 검토 · 상대 직업 추측 ↗' : noticeReview ? '다음 검토 · 남은 시간 ↗' : '다음 검토 · 공지 ↗'}</a>
      {timerReview && <a className="sp-original-link" href="./issue-294-notices.html">이전 검토 · 공지 ↗</a>}
      {noticeReview && <a className="sp-original-link" href="./issue-294-speaking.html">대화창 검토로 돌아가기 ↗</a>}
    </section>
  </>;
  const product = <SpeakingPlaza key={round} c={c} messages={messages} notices={notices}
    squareVariant={squareReview ? squareVariant : 'original'}
    whisperArrival={whisperArrival}
    timeDisplay={liveTimer ? <PlazaTimer key={timer.revision} snapshot={timer} /> : undefined}
    roleGuesses={guessReview || squareReview ? roleGuesses : undefined}
    onRoleGuess={(seat, roleId) => setRoleGuesses((all) => {
      const next = { ...all };
      if (roleId) next[seat] = roleId;
      else delete next[seat];
      return next;
    })}
    view={view} setView={setView} privateMessages={view.kind === 'whisper' ? whispers[view.seat]?.messages ?? [] : []}
    whisperUnread={Object.fromEntries(Object.entries(whispers).map(([seat, thread]) => [seat, thread.unread]))}
    draft={view.kind === 'whisper' ? whisperDrafts[view.seat] ?? '' : draft} composing={composing} sendAvailableAt={view.kind === 'public' ? publicSendAvailableAt : 0}
    setDraft={(value) => { if (view.kind === 'whisper') setWhisperDrafts((all) => ({ ...all, [view.seat]: value })); else setDraft(value); }} setComposing={setComposing}
    onBegin={begin} onReadNotice={readNotices} onReadWhisper={readWhisper}
    onSend={(text) => {
      const now = performance.now();
      if (!text.trim()) return false;
      if (view.kind === 'public') {
        if (now < nextPublicSendAt.current) return false;
        // Keep the public deadline while the participant visits a whisper conversation.
        nextPublicSendAt.current = now + 3000;
        setPublicSendAvailableAt(nextPublicSendAt.current);
      }
      const message = { id: nextId.current++, seat: c.meSeat, text };
      if (view.kind === 'whisper') setWhispers((all) => ({ ...all, [view.seat]: {
        messages: [...(all[view.seat]?.messages ?? []), message], unread: all[view.seat]?.unread ?? 0,
      } }));
      else setMessages((m) => [...m, message]);
      return true;
    }} />;

  return wide ? <div className="rv-wide sp-review"><aside className="rv-panel"><header><span className="rv-tag">검토 {reviewNumber}</span><h1>#294 · {reviewTitle}</h1></header>{controls}</aside><main className="rv-stage"><div className="rv-phone"><div className="rv-phone-screen"><div className="rv-phone-app">{product}</div>{keyboard && <div className="rv-keyboard"><span>키보드 자리</span><button type="button" onPointerDown={(e) => e.preventDefault()} onClick={() => { if (document.activeElement instanceof HTMLTextAreaElement) document.activeElement.blur(); }}>키보드 닫기</button></div>}</div></div></main></div>
    : <div ref={viewportRef} className="rv-narrow sp-review"><div className={`rv-bar ${panelOpen ? 'open' : ''}`}><button type="button" className="rv-bar-toggle" onClick={() => setPanelOpen((o) => !o)}><span className="rv-tag">검토 {reviewNumber}</span>{squareReview ? '광장 뒷줄' : guessReview ? '상대 직업 추측' : timerReview ? '남은 시간' : noticeReview ? '공지 전달' : '광장 대화'} · {count}인<span className="rv-bar-caret">{panelOpen ? '닫기' : '설정'}</span></button>{panelOpen && <div className="rv-bar-body">{controls}</div>}</div><main className="rv-product">{product}</main></div>;
}

const root: Root = import.meta.hot?.data.root ?? createRoot(document.getElementById('root')!);
if (import.meta.hot) import.meta.hot.data.root = root;
root.render(<App />);
