import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CustomScenarioEditor } from '../custom/authoring/CustomScenarioEditor';
import { type ValidatedScenario, validateScenarioCandidate } from '../custom/core/definitionValidator';
import { customFirstNightPlan, loadCustomDefinitionValidator, wasmCoreAdapter } from '../custom/core/wasmClient';
import { GrimoireSetupController, type GrimoireSetupDraft, type GrimoirePresentationState } from '../custom/grimoire/setupController';
import type { CustomWebSessionSnapshot, CustomWebSessionStorageDriver } from '../custom/storage/sessionStorage';
import { CustomGrimoireSetup } from './CustomGrimoireSetup';
import './setupReview.css';

function SetupReview() {
  const [controller, setController] = useState<GrimoireSetupController>();
  const active = useRef<GrimoireSetupController | undefined>(undefined);
  const [sourceFile, setSourceFile] = useState<File>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => () => active.current?.dispose(), []);
  function start(scenario: ValidatedScenario) {
    active.current?.dispose();
    // The review route deliberately uses memory storage, with real engine execution.
    let saved: CustomWebSessionSnapshot<GrimoireSetupDraft, GrimoirePresentationState> | undefined;
    const storage: CustomWebSessionStorageDriver<GrimoireSetupDraft, GrimoirePresentationState> = {
      loadSession: async () => saved ? { status: 'loaded', snapshot: structuredClone(saved) } : { status: 'missing' },
      saveSession: async snapshot => { saved = structuredClone(snapshot); },
      replaceUnreadableSession: async () => { throw new Error('검토 화면에는 손상된 저장본이 없습니다.'); },
    };
    const next = new GrimoireSetupController(scenario, { core: wasmCoreAdapter, storage });
    active.current = next;
    setController(next);
    void next.initialize();
  }
  async function sample() {
    setLoading(true); setError('');
    try {
      const draft = { id: 'issue-220-review', name: 'TB · SnV 혼합 시나리오', characterIds: [
        'washerwoman', 'librarian', 'investigator', 'chef', 'empath', 'fortuneTeller', 'soldier', 'mayor', 'virgin', 'slayer',
        'clockmaker', 'dreamer', 'seamstress', 'philosopher', 'snakeCharmer', 'mathematician',
        'drunk', 'recluse', 'butler', 'mutant', 'poisoner', 'scarletWoman', 'witch', 'evilTwin', 'baron', 'cerenovus', 'imp', 'vortox', 'fangGu', 'noDashii',
      ] };
      const plan = await customFirstNightPlan(draft);
      if (!plan.ok) throw new Error(plan.error.messageKo);
      start(await validateScenarioCandidate({ ...draft, firstNightOrder: plan.value.plan }, loadCustomDefinitionValidator));
    } catch (cause) { setError(cause instanceof Error ? cause.message : '시나리오를 열지 못했습니다.'); }
    finally { setLoading(false); }
  }
  return <>
    {controller ? <CustomGrimoireSetup controller={controller} onNewGame={()=>start({definition:controller.getSnapshot().definition})} onImport={file=>{active.current?.dispose();active.current=undefined;setController(undefined);setSourceFile(file);}} /> : <CustomScenarioEditor sourceFile={sourceFile} onExit={() => { window.location.href = '/clocktower/'; }} onNewGrimoire={start} />}
    <aside className="setupReviewTools" aria-label="검토 도구"><strong>#220 · 설정 연결 검토</strong>
      <span>실제 커스텀 엔진으로 게임 설정까지 확인합니다. 첫날 밤 조작·저장/재개 화면은 다음 단계입니다. 저장은 이 탭의 메모리에서만 이뤄지며 새로고침하면 초기화됩니다.</span>
      <div><button type="button" disabled={loading} onClick={() => void sample()}>{loading ? '준비 중…' : '혼합 시나리오로 설정 열기'}</button>
        <button type="button" disabled={loading} onClick={() => { active.current?.dispose(); active.current = undefined; setController(undefined); }}>시나리오 작성부터</button></div>
      {error && <p role="alert">{error}</p>}
    </aside>
  </>;
}

createRoot(document.getElementById('root')!).render(<SetupReview />);
