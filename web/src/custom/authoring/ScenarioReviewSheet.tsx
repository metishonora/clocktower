import type { ImportedGame } from './importScenarioSource.js';
import type { ValidatedScenario } from '../core/definitionValidator.js';
import type { ScenarioEditorController } from './scenarioEditorController.js';
import { blockingMessage } from './scenarioEditorController.js';
import type { ScenarioEditorState } from './scenarioEditorState.js';
import { countsFor, kindOrder, kindLabels, recommendedMinimums, characterPresentation } from './characterPresentation.js';
export function ScenarioReviewSheet({ state, controller, onNewGrimoire, onResume }: { state: ScenarioEditorState; controller: ScenarioEditorController; onNewGrimoire?: (scenario: ValidatedScenario) => void; onResume?: (game: ImportedGame) => void }) {
  const { draft } = state;
  const counts = countsFor(draft.characterIds);
  const error = blockingMessage(state.error);
  const shortages = kindOrder.filter(kind => counts[kind] < recommendedMinimums[kind]);
  const resumable = controller.getResumableGame();
  const invalid = state.validation !== 'valid';
  return <section className={`issue202Gate4Sheet${invalid ? ' is-invalid' : ''}`} aria-labelledby="review-title">
    <header className="issue202Gate4Header"><div><small>Ⅳ</small><div><h1 id="review-title">최종 검토</h1><p>{draft.name || '이름 없는 시나리오'}</p></div></div></header>
    <div className="issue202Gate4ReviewScroll">
      <dl className="issue202Gate4Composition">
        <div className="is-name"><dt><label htmlFor="scenario-name">시나리오 이름</label></dt><dd><input id="scenario-name" value={draft.name}
          placeholder="시나리오 이름" aria-invalid={state.error?.section === 'name'} onChange={event => controller.setName(event.currentTarget.value)} /></dd></div>
        <div><dt>Character</dt><dd>{draft.characterIds.length}명</dd></div>
        {kindOrder.map(kind => <div key={kind}><dt>{kindLabels[kind]}</dt><dd>{counts[kind]}명</dd></div>)}
      </dl>
      <div className="issue202Gate4Content">
        <section className="issue202Gate4Roster" aria-label="Character 목록"><header><h2>Character 목록</h2><span>{draft.characterIds.length}명</span></header>
          <div className="issue202Gate4RosterGroups">{kindOrder.map(kind => <section key={kind} className={`is-${kindLabels[kind]}`}>
            <h3>{kindLabels[kind]}<small>{counts[kind]}</small></h3><ul>{draft.characterIds.map(characterPresentation).filter(entry => entry?.kind === kind).map(entry => entry &&
              <li key={entry.id}><span><img src={entry.image} alt="" /></span><strong>{entry.label}</strong></li>)}</ul>
          </section>)}</div>
        </section>
        <aside className="issue202Gate4ActionPanel" aria-label="최종 작업">
          {shortages.length > 0 && !invalid && <section className="issue202Gate4Recommendation" aria-label="권장 구성 경고"><strong>캐릭터가 부족합니다.</strong><ul>
            {shortages.map(kind => <li key={kind}><span>{kindLabels[kind]}</span><b>{counts[kind]}/{recommendedMinimums[kind]}</b></li>)}
          </ul></section>}
          <button type="button" className="is-save" disabled={invalid || state.orderPending} onClick={controller.save}>시나리오 저장</button>
          <button type="button" className={!resumable ? "is-primary" : undefined} disabled={!onNewGrimoire || invalid || state.orderPending} onClick={() => {
            const scenario = controller.getValidatedScenario();
            if (scenario) onNewGrimoire?.(scenario);
          }}>새 마도서 쓰기</button>{resumable && onResume && <button type="button" className="is-primary" onClick={() => { const game = controller.getResumableGame(); if (game) onResume(game); }}>마도서 이어 쓰기</button>}
          <div aria-live="polite">{state.downloadStatus === 'requested' && <p>다운로드를 요청했습니다.</p>}
            {state.downloadError && <p role="alert">{state.downloadError}</p>}</div>
        </aside>
      </div>
      <footer className="issue202Gate4Footer"><button type="button" className="issue202Gate4Back" onClick={() => controller.setStep(state.error?.section === 'characters' ? 'characters' : 'nightOrder')}>
        {state.error?.section === 'characters' ? '← 캐릭터 설정으로 돌아가기' : '← 밤 행동 순서로 돌아가기'}</button></footer>
    </div>
    <div className="issue202Gate4ErrorReason" aria-live="polite">
      {error ? <strong role="alert">{error}</strong> : state.validation === 'pending' ? <span>시나리오를 확인하고 있습니다.</span> : null}
      {state.error?.section === 'operation' && <button type="button" onClick={controller.retry}>다시 시도</button>}
    </div>
  </section>;
}
