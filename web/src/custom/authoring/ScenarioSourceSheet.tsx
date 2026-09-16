import { useRef } from 'react';
import type { ScenarioEditorController } from './scenarioEditorController.js';
import type { ScenarioEditorState } from './scenarioEditorState.js';
export function ScenarioSourceSheet({ state, controller }: { state: ScenarioEditorState; controller: ScenarioEditorController; onExit: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  return <section className="issue202AltScenarioSheet customScenarioSource" aria-labelledby="scenario-title">
    <header><h1 id="scenario-title">Ⅰ. 시나리오 선택</h1></header>
    <div className="issue202AltFlatChoices" role="group" aria-label="시나리오 작업 선택">
      <button type="button" aria-pressed={state.source === 'new'} onClick={() => controller.selectSource('new')}><strong>새롭게 작성한다</strong></button>
      <button type="button" aria-pressed={state.source === 'json'} onClick={() => controller.selectSource('json')}><strong>JSON에서 불러온다</strong></button>
    </div>
    <input hidden ref={input} type="file" accept=".json,application/json" aria-label="시나리오 JSON 파일"
      onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void controller.importFile(file); }} />
    {state.source === 'json' && <div className="customScenarioImport" aria-live="polite">
      <button type="button" onClick={() => { controller.beginFileSelection(); input.current?.click(); }}>JSON 파일 선택</button>
      {state.importStatus === 'reading' && <p role="status">확인 중…</p>}
      {state.importError && <p role="alert">{state.importError}</p>}
    </div>}
    {state.source === 'new' && <footer><button type="button" className="issue202AltPrimaryAction" onClick={controller.startNew}>다음으로</button></footer>}
  </section>;
}
