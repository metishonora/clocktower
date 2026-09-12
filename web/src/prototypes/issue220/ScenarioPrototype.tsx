import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import manuscript from '../../assets/prototypes/issue-200/continuous-manuscript-dolly-master-v6.png';
import { CharacterPoolSheet } from '../../custom/authoring/CharacterPoolSheet';
import { catalog, countsFor, kindOrder, kindLabels, recommendedMinimums, characterPresentation, type KindFilter, type SourceFilter } from '../../custom/authoring/characterPresentation';
import { OrderPanel, type OrderEntry } from './OrderPanel';
import orderFixture from './firstNight.fixture.json';
import '../../custom/authoring/scenarioEditor.css';
import './prototype.css';
import '../../sectsAndVioletsApp.css';
import '../../scriptSelectionPrototype.css';
import { CustomGrimoireSetup } from './Grimoire';
import { GrimoireSetupController, demoIds } from './fixtureController';
import './connection.css';

type Draft = { id: string; name: string; ids: string[]; order: string[] };
type Step = 'scenario' | 'characters' | 'nightOrder' | 'review';
type Source = 'new' | 'json';
type FileResult = 'scenario' | 'game' | 'invalid' | 'cancel';
const systemLabels: Record<string, string> = { dusk: '해질녘', dawn: '새벽', minionInfo: '하수인 정보', demonInfo: '악마 정보' };
const fixtureEntries: OrderEntry[] = orderFixture.map(a => ({ id: a.kind === 'system' ? a.actionId : `${a.characterId}:${a.actionId}`, label: a.kind === 'system' ? systemLabels[a.actionId] : characterPresentation(a.characterId!)?.label ?? a.characterId!, kind: a.kind === 'system' ? (a.actionId === 'dusk' || a.actionId === 'dawn' ? 'boundary' : 'system') : 'character', characterId: a.characterId }));
const entryMap = new Map(fixtureEntries.map(a => [a.id, a]));
const initialIds = demoIds;
function defaultOrder(ids: string[]) { return fixtureEntries.filter(a => !a.characterId || ids.includes(a.characterId)).map(a => a.id); }
function makeDraft(name = '등불 아래의 속삭임', ids = initialIds, id = 'lantern'): Draft { return { name, ids: [...ids], order: defaultOrder(ids), id }; }
const clone = <T,>(v: T): T => structuredClone(v);
const same = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b);
let nextId = 0;

function App() {
  const [consoleState, setConsoleState] = useState<GrimoireSetupController>();
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<{draft: Draft; resume: boolean}>();
  useEffect(() => { if (!pending) return; setLoading(true); const timer = window.setTimeout(() => { setConsoleState(new GrimoireSetupController(pending.draft, pending.resume)); setLoading(false); setPending(undefined); }, 850); return () => window.clearTimeout(timer); }, [pending]);
  const [step, setStep] = useState<Step>('scenario');
  const [source, setSource] = useState<Source>('new');
  const [draft, setDraft] = useState<Draft>(() => makeDraft('', [], 'new'));
  const [game, setGame] = useState<Draft>();
  const [notice, setNotice] = useState('');
  const [operationError, setOperationError] = useState('');
  const [fileError, setFileError] = useState('');
  const [kind, setKind] = useState<KindFilter>('Townsfolk');
  const [filter, setFilter] = useState<SourceFilter>('all');
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState<string>();
  const [dockOpen, setDockOpen] = useState(false);
  const [fileResult, setFileResult] = useState<FileResult>('scenario');
  const [failNext, setFailNext] = useState(false);
  const [boundary, setBoundary] = useState('');
  const [invalidOrder, setInvalidOrder] = useState(false);
  const counts = countsFor(draft.ids);
  const invalid = !draft.name.trim() ? '이름이 올바르지 않습니다.' : !draft.ids.length ? '캐릭터 설정이 올바르지 않습니다.' : invalidOrder ? '밤 행동 순서가 올바르지 않습니다.' : '';
  const canResume = Boolean(game && same(game, draft) && !invalid);
  const shortages = kindOrder.filter(k => counts[k] < recommendedMinimums[k]);
  const visible = catalog.filter(c => (kind === 'all' || c.kind === kind) && (filter === 'all' || c.source === filter) && `${c.label} ${c.englishLabel}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => a.label.localeCompare(b.label, 'ko'));

  const go = (s: Step) => { setStep(s); setNotice(''); setOperationError(''); setBoundary(''); };
  const loadDraft = (d: Draft, active?: Draft) => { setDraft(clone(d)); setGame(active ? clone(active) : undefined); setInvalidOrder(false); setNotice(''); setOperationError(''); };
  function toggleCharacter(id: string) {
    setFocused(id); setInvalidOrder(false); setNotice('');
    setDraft(d => {
      const ids = d.ids.includes(id) ? d.ids.filter(x => x !== id) : [...d.ids, id];
      const defaults = defaultOrder(ids);
      const order = d.order.filter(x => defaults.includes(x));
      defaults.forEach((key, i) => { if (!order.includes(key)) { const next = defaults.slice(i + 1).find(x => order.includes(x)); order.splice(next ? order.indexOf(next) : order.length, 0, key); } });
      return { ...d, ids, order };
    });
  }
  function tryOperation() { if (failNext) { setFailNext(false); setOperationError('저장하지 못했습니다. 다시 시도해 주세요.'); return false; } setOperationError(''); return true; }
  function selectFile() {
    setNotice(''); setFileError('');
    if (fileResult === 'cancel') return;
    if (fileResult === 'invalid') { setFileError('파일을 불러올 수 없습니다. 다른 JSON 파일을 선택해 주세요.'); return; }
    const imported = fileResult === 'game' ? makeDraft() : makeDraft('가을밤의 방문객', initialIds, `import-${++nextId}`);
    loadDraft(imported, fileResult === 'game' ? imported : undefined);
    go('review');
  }
  function startNewBoundary() { setPending({draft: clone(draft), resume: false}); }
  function applyFixture(value: string) {
    setConsoleState(undefined); setBoundary(''); setFileError(''); setOperationError(''); setNotice('');
    if (value === 'source') { setSource('new'); go('scenario'); return; }
    if (value === 'files') { setSource('json'); go('scenario'); return; }
    const d = makeDraft();
    if (value === 'full') { d.ids = catalog.map(c => c.id); d.order = defaultOrder(d.ids); }
    loadDraft(value === 'changed' ? { ...d, name: `${d.name} · 수정본` } : d, ['resume', 'changed'].includes(value) ? d : undefined);
    setInvalidOrder(value === 'invalid'); setStep('review');
  }
  return <div className="p205Root">
    {consoleState ? <div className="p220Console"><CustomGrimoireSetup controller={consoleState} /></div> : <div className="p205Product customScenarioSurface issue202AltPrototype issue202Gate3Prototype issue202Gate4Prototype">
      <main className={`issue202AltEditor is-${step}`} aria-label="커스텀 시나리오 작성">
        <figure className="issue202AltArtwork" aria-hidden="true"><img src={manuscript} alt="" /></figure><div className="issue202AltVignette" aria-hidden="true" />
        <div className="scenarioSheets">
          {step === 'scenario' ? <section className="issue202AltScenarioSheet p205Source" aria-labelledby="source-title">
            <header><h1 id="source-title">Ⅰ. 시나리오 선택</h1></header>
            <div className="issue202AltFlatChoices" role="group" aria-label="시나리오 작업 선택">
              {([['new','새롭게 작성한다'],['json','JSON에서 불러온다']] as const).map(([key,label]) => <button type="button" key={key} aria-pressed={source === key} onClick={() => { setSource(key); setFileError(''); }}><strong>{label}</strong></button>)}
            </div>
            <div className="p205SourceBody">
              {source === 'new' ? null : <div className="p205Import">
                <button className="p205FileSelect" onClick={selectFile}><strong>JSON 파일 선택</strong></button>
                {fileError && <p className="p205FileError" role="alert">{fileError}</p>}
              </div>}
            </div>
            {source === 'new' && <footer>
              <button className="issue202AltPrimaryAction" onClick={() => { loadDraft(makeDraft('', [], `new-${++nextId}`)); go('characters'); }}>다음으로</button>
            </footer>}
          </section> : step === 'characters' ? <CharacterPoolSheet name={draft.name} selectedIds={draft.ids} counts={counts} activeKind={kind} sourceFilter={filter} query={query} characters={visible} focusedCharacter={focused ? characterPresentation(focused) : undefined}
            onNameChange={name => { setDraft(d => ({ ...d, name })); setNotice(''); }} onActiveKindChange={k => { setKind(k); setQuery(''); setFocused(undefined); }} onSourceFilterChange={f => { setFilter(f); setQuery(''); setFocused(undefined); }} onQueryChange={q => { setQuery(q); if (q) { setKind('all'); setFilter('all'); } setFocused(undefined); }} onToggleCharacter={toggleCharacter} onCloseCharacter={() => setFocused(undefined)} onBack={() => go('scenario')} onContinue={() => go('nightOrder')} />
          : step === 'nightOrder' ? <section className="issue202Gate3Sheet scenarioFirstNight" aria-labelledby="order-title"><header className="issue202Gate3Header"><div><small>Ⅲ</small><h1 id="order-title">밤 행동 순서</h1></div></header><div aria-live="polite">{invalidOrder ? '밤 행동 순서가 올바르지 않습니다.' : null}</div>
            <OrderPanel night="first" title="첫날 밤" entries={draft.order.map(id => entryMap.get(id)!).filter(Boolean)} busy={false} onRestore={() => { setDraft(d => ({ ...d, order: defaultOrder(d.ids) })); setInvalidOrder(false); }} onMove={(_, id, direction) => setDraft(d => { const order = [...d.order]; const i = order.indexOf(id); if (i > 0 && i + direction > 0 && i + direction < order.length - 1) [order[i], order[i + direction]] = [order[i + direction], order[i]]; return { ...d, order }; })} />
            <footer className="scenarioNavigation"><button onClick={() => go('characters')}>← 캐릭터 설정으로</button><button disabled={invalidOrder} onClick={() => go('review')}>최종 검토로</button></footer>
          </section> : <section className={`issue202Gate4Sheet${invalid ? ' is-invalid' : ''}`} aria-labelledby="review-title">
            <header className="issue202Gate4Header"><div><small>Ⅳ</small><div><h1 id="review-title">최종 검토</h1><p>{draft.name || '이름 없는 시나리오'}</p></div></div></header>
            <div className="issue202Gate4ReviewScroll">
              <dl className="issue202Gate4Composition"><div className="is-name"><dt><label htmlFor="scenario-name">시나리오 이름</label></dt><dd><input id="scenario-name" value={draft.name} placeholder="시나리오 이름" aria-invalid={!draft.name.trim()} onChange={e => { setDraft(d => ({ ...d, name: e.target.value })); setNotice(''); }} /></dd></div><div><dt>Character</dt><dd>{draft.ids.length}명</dd></div>{kindOrder.map(k => <div key={k}><dt>{kindLabels[k]}</dt><dd>{counts[k]}명</dd></div>)}</dl>
              <div className="issue202Gate4Content"><section className="issue202Gate4Roster" aria-label="Character 목록"><header><h2>Character 목록</h2><span>{draft.ids.length}명</span></header><div className="issue202Gate4RosterGroups">{kindOrder.map(k => <section key={k}><h3>{kindLabels[k]}<small>{counts[k]}</small></h3><ul>{draft.ids.map(characterPresentation).filter(c => c?.kind === k).map(c => c && <li key={c.id}><span><img src={c.image} alt="" /></span><strong>{c.label}</strong></li>)}</ul></section>)}</div></section>
                <aside className="issue202Gate4ActionPanel p205Actions" aria-label="최종 작업">
                  {canResume && <section className="p205Progress"><strong>이전에 쓰던 마도서</strong><span>첫날 밤 · 생존 5명 · 사망 0명</span></section>}
                  {!invalid && shortages.length > 0 && <section className="issue202Gate4Recommendation"><strong>캐릭터가 부족합니다.</strong><ul>{shortages.map(k => <li key={k}><span>{kindLabels[k]}</span><b>{counts[k]}/{recommendedMinimums[k]}</b></li>)}</ul></section>}
                  <button className="is-save" disabled={!!invalid} onClick={() => { if (tryOperation()) setNotice('다운로드를 요청했습니다.'); }}>시나리오 저장</button>
                  <button className={!canResume ? 'is-primary' : ''} disabled={!!invalid} onClick={startNewBoundary}>새 마도서 쓰기</button>
                  {canResume && <button className="is-primary" onClick={() => setPending({draft: clone(draft), resume: true})}>마도서 이어 쓰기</button>}
                  <div className="p205Feedback" aria-live="polite">{notice && <p>{notice}</p>}{operationError && <p role="alert">{operationError}</p>}</div>
                </aside>
              </div>
              <footer className="issue202Gate4Footer"><button className="issue202Gate4Back" onClick={() => go(!draft.ids.length ? 'characters' : 'nightOrder')}>{!draft.ids.length ? '← 캐릭터 설정으로 돌아가기' : '← 밤 행동 순서로 돌아가기'}</button></footer>
            </div><div className="issue202Gate4ErrorReason" aria-live="polite">{invalid && <strong role="alert">{invalid}</strong>}</div>
          </section>}
        </div>
      </main>
    </div>
    }
    {loading && <div className="scriptLoading p220Loading" role="status"><span className="loadingMark" aria-hidden="true">☾</span><span>{draft.name} 준비 중</span></div>}
    <footer className="p205Dock" aria-label="프로토타입 검토 도구"><div className="p205DockBar"><strong>#220 <span>편집 → 마도서 검토</span></strong><span className="p205Mode" role="status">{consoleState ? '마도서 · 예시 진행' : '승인된 시나리오 편집'}</span><button aria-expanded={dockOpen} onClick={() => setDockOpen(!dockOpen)}>검토 도구 {dockOpen ? '닫기' : '열기'}</button></div>
      {dockOpen && <div className="p205DockPanel"><p>검토 전용 · 파일·배역 분포·첫날 밤 결과·이어 쓰기는 예시 상태입니다. 규칙 판정과 실제 저장은 하지 않으며 새로고침하면 초기화됩니다. 첫날 밤 정보 예시는 5인 혼합 구성으로 검토합니다.</p><div className="p205Controls">
        <label>파일 선택 결과<select value={fileResult} onChange={e => setFileResult(e.target.value as FileResult)}><option value="scenario">시나리오 JSON</option><option value="game">마도서 JSON · 진행 기록 있음</option><option value="invalid">잘못된 파일</option><option value="cancel">선택 취소</option></select></label>
        <label>검토할 화면<select value="" onChange={e => { applyFixture(e.target.value); setDockOpen(false); }}><option value="" disabled>상태 선택</option><option value="source">시작 화면</option><option value="files">파일 불러오기</option><option value="new">작성 완료</option><option value="resume">이어 쓰기 가능</option><option value="changed">편집 후 이어 쓰기 불가</option><option value="full">47명 전체 구성</option><option value="invalid">밤 순서 오류</option></select></label>
        <button disabled={!consoleState || !!consoleState.state.replay} onClick={() => { if (!consoleState) return; consoleState.setPlayerCount(5); ['chef','empath','clockmaker','poisoner','imp'].filter(id => consoleState.scenario.ids.includes(id)).forEach(id => consoleState.toggleCharacter(id)); consoleState.assignRemaining(); consoleState.navigate('seating'); setDockOpen(false); }}>5인 혼합 배역·좌석 예시</button>
        <button aria-pressed={failNext} onClick={() => setFailNext(!failNext)}>{failNext ? '다음 저장 실패 예정' : '다음 저장 실패시키기'}</button>
        <button disabled={!game} onClick={() => { if (game) { setDraft(clone(game)); setInvalidOrder(false); setNotice(''); } setDockOpen(false); }}>원래 시나리오 복구</button>
      </div>{boundary && <div className="p205Boundary"><strong>검토 경계: {boundary}</strong><span>실제 게임과 저장 데이터는 변경하지 않았습니다.</span><button onClick={() => { setBoundary(''); setDockOpen(false); }}>편집 검토 계속</button></div>}</div>}
    </footer>

  </div>;
}
const root = createRoot(document.getElementById('root')!);
const reviewWidth = Number(new URLSearchParams(location.search).get('viewport'));
root.render([320,390,820].includes(reviewWidth) ? <div style={{height:'100dvh',overflow:'auto',background:'#101820',display:'grid',justifyItems:'center',alignContent:'start',padding:12,gap:8}}><span style={{color:'#dce4eb',font:'13px system-ui'}}>검토 전용 · {reviewWidth} × 600 CSS px</span><iframe title="반응형 프로토타입 검토" src={location.pathname} style={{width:reviewWidth,height:600,border:'1px solid #647381',flexShrink:0}} /></div> : <App />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
