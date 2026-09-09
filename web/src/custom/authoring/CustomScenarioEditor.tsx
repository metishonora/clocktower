import { useEffect, useState } from 'react';
import manuscript from '../../assets/prototypes/issue-200/continuous-manuscript-dolly-master-v6.png';
import { useScenarioEditor } from './useScenarioEditor.js';
import { ScenarioSourceSheet } from './ScenarioSourceSheet.js';
import { CharacterPoolSheet } from './CharacterPoolSheet.js';
import { FirstNightOrderSheet } from './FirstNightOrderSheet.js';
import { ScenarioReviewSheet } from './ScenarioReviewSheet.js';
import { catalog, countsFor, characterPresentation, type KindFilter, type SourceFilter } from './characterPresentation.js';
import './scenarioEditor.css';
export function CustomScenarioEditor({ onExit }: { onExit: () => void }) {
  const { state, controller } = useScenarioEditor();
  const [kind, setKind] = useState<KindFilter>('Townsfolk');
  const [source, setSource] = useState<SourceFilter>('all');
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState<string>();
  const [entering, setEntering] = useState(true);
  useEffect(() => {
    const previous = document.title; document.title = '커스텀 시나리오 · Clocktower';
    const timer = window.setTimeout(() => setEntering(false), 900);
    return () => { document.title = previous; window.clearTimeout(timer); };
  }, []);
  const changeQuery = (next: string) => {
    setQuery(next);
    if (next.length > 0) {
      setKind('all');
      setSource('all');
    }
    setFocused(undefined);
  };
  const changeKind = (next: KindFilter) => {
    setKind(next);
    setQuery('');
    setFocused(undefined);
  };
  const changeSource = (next: SourceFilter) => {
    setSource(next);
    setQuery('');
    setFocused(undefined);
  };
  const visible = catalog.filter(entry => (kind === 'all' || entry.kind === kind) && (source === 'all' || entry.source === source)
    && `${entry.label} ${entry.englishLabel}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    .sort((a, b) => a.label.localeCompare(b.label, 'ko'));
  return <div className="customScenarioSurface issue202AltPrototype issue202Gate3Prototype issue202Gate4Prototype">
    <div className="issue202AltProductStage"><main className={`issue202AltEditor is-${state.step}`} aria-label="커스텀 시나리오 작성">
      <figure className="issue202AltArtwork" aria-hidden="true"><img src={manuscript} alt="" /></figure><div className="issue202AltVignette" aria-hidden="true" />
      <div className={`scenarioSheets${entering ? ' is-entering' : ''}`}>
        {state.step === 'scenario' ? <ScenarioSourceSheet state={state} controller={controller} onExit={onExit} />
        : state.step === 'characters' ? <CharacterPoolSheet name={state.draft.name} selectedIds={state.draft.characterIds} counts={countsFor(state.draft.characterIds)}
          activeKind={kind} sourceFilter={source} query={query} characters={visible} focusedCharacter={focused ? characterPresentation(focused) : undefined}
          onNameChange={controller.setName} onActiveKindChange={changeKind} onSourceFilterChange={changeSource} onQueryChange={changeQuery}
          onToggleCharacter={id => { setFocused(id); controller.toggleCharacter(id); }} onCloseCharacter={() => setFocused(undefined)}
          onBack={() => controller.setStep('scenario')} onContinue={() => controller.setStep('nightOrder')} />
        : state.step === 'nightOrder' ? <FirstNightOrderSheet state={state} controller={controller} />
        : <ScenarioReviewSheet state={state} controller={controller} />}
      </div>
    </main></div>
  </div>;
}
