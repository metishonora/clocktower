import { useRef } from 'react';
import type { ScenarioEditorController } from './scenarioEditorController.js';
import type { ScenarioEditorState } from './scenarioEditorState.js';
export function ScenarioSourceSheet({ state, controller, onExit }: { state: ScenarioEditorState; controller: ScenarioEditorController; onExit: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  return <section className="issue202AltScenarioSheet" aria-labelledby="scenario-title">
    <header><h1 id="scenario-title">Ⅰ. 시나리오 선택</h1></header>
    <div className="issue202AltFlatChoices" role="group" aria-label="시나리오 작업 선택">
      <button type="button" aria-pressed={state.source === 'new'} onClick={() => controller.selectSource('new')}><strong>새롭게 작성한다</strong></button>
      <button type="button" disabled><strong>저장본을 연다</strong></button>
      <button type="button" aria-pressed={state.source === 'json'} onClick={() => controller.selectSource('json')}><strong>JSON에서 불러온다</strong></button>
    </div>
    <input hidden ref={input} type="file" accept=".json,application/json" aria-label="시나리오 JSON 파일"
      onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void controller.importFile(file); }} />
    <div className="issue202AltScenarioDetail issue202AltJsonStatus" aria-live="polite">
      {state.source === 'json' && <>
        {state.importStatus === 'reading' ? <p>시나리오를 확인하고 있습니다.</p>
          : state.importStatus === 'error' ? <p className="is-error" role="alert">{state.importError}</p>
          : state.importStatus === 'ready' ? <p><strong>{state.importName}</strong><span>시나리오를 불러왔습니다.</span></p>
          : <p>Clocktower 시나리오 JSON을 선택합니다.</p>}
        <button type="button" className="scenarioSecondary" onClick={() => { controller.beginFileSelection(); input.current?.click(); }}>JSON 파일 선택</button>
      </>}
    </div>
    <footer>
      <button type="button" className="scenarioSecondary" onClick={onExit}>스크립트 선택으로</button>
      <button type="button" className="issue202AltPrimaryAction" disabled={state.source === 'json' && state.importStatus !== 'ready'}
        onClick={() => state.source === 'new' ? controller.startNew() : controller.setStep('review')}>
        {state.source === 'new' ? '다음으로' : '검토로'}
      </button>
    </footer>
  </section>;
}
