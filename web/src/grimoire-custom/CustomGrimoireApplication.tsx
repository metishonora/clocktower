import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CustomScenarioEditor } from '../custom/authoring/CustomScenarioEditor';
import { CustomGrimoireApplicationController } from '../custom/grimoire/applicationController';
import { activeCustomSessionId } from '../custom/grimoire/browserSessionNavigation';
import { CustomBrowserNavigation, readCustomRoute, type CustomRoute } from '../custom/grimoire/customRoutes';
import { warmCustomShell } from '../custom/grimoire/customShellCache';
import { wasmCoreAdapter } from '../custom/core/wasmClient';
import type { ValidatedScenario } from '../custom/core/definitionValidator';
import { CustomGrimoireSetup } from './CustomGrimoireSetup';
import { CustomGrimoirePlay } from './CustomGrimoirePlay';
import { CustomSavedGames } from './CustomSavedGames';
import './customGrimoirePlay.css';

export function CustomGrimoireApplication({ onExit }: { onExit: () => void }) {
  const [initial] = useState(() => ({route: readCustomRoute(), legacyId: location.pathname === '/clocktower/' ? activeCustomSessionId() : undefined}));
  const [route, setRoute] = useState<CustomRoute>(initial.route);
  const navigationRef = useRef<CustomBrowserNavigation>(undefined);
  const [controller] = useState(() => new CustomGrimoireApplicationController(wasmCoreAdapter, (_scriptId, gameId) => {
    const next: CustomRoute = {kind: 'game', gameId};
    navigationRef.current?.activate(next); setRoute(next);
  }));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [sourceFile, setSourceFile] = useState<File>();
  const [starting, setStarting] = useState<ValidatedScenario>();
  const [editorGeneration, setEditorGeneration] = useState(0);
  const [notice, setNotice] = useState<string>();
  const recoveryInput = useRef<HTMLInputElement>(null);
  const applyRef = useRef<(next: CustomRoute) => void>(() => {});
  const [navigation] = useState(() => new CustomBrowserNavigation(controller, next => applyRef.current(next)));
  navigationRef.current = navigation;
  applyRef.current = next => {
    setStarting(undefined); setRoute(next); setNotice(undefined);
    if (next.kind === 'game') void controller.restoreGame(next.gameId);
    else if (next.kind === 'editor') controller.openEditor();
    else {
      controller.openLibrary();
      if (next.kind === 'setup') setNotice('게임 설정이 저장되지 않았습니다.');
      if (next.kind === 'invalid') setNotice('마도서 주소가 올바르지 않습니다.');
    }
  };
  useEffect(() => navigation.connect(), [navigation]);
  useEffect(warmCustomShell, []);
  useEffect(() => {
    if (initial.legacyId) void controller.restoreLegacy(initial.legacyId);
    else {
      navigation.commit(initial.route, true);
      applyRef.current(initial.route);
    }
  }, [controller, navigation, initial]);
  // React StrictMode replays effect setup/cleanup; only a real unmount retires ownership.
  const lifecycle = useRef(0);
  useEffect(() => {
    const generation = ++lifecycle.current;
    return () => { queueMicrotask(() => { if (generation === lifecycle.current) controller.dispose(); }); };
  }, [controller]);
  useEffect(() => {
    if (!starting) return;
    const timer = window.setTimeout(() => {
      controller.startSetup(starting); setStarting(undefined);
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 820);
    return () => window.clearTimeout(timer);
  }, [starting, controller]);
  useEffect(() => {
    document.title = route.kind === 'editor' ? '커스텀 시나리오 · Clocktower' : '커스텀 마도서 · Clocktower';
  }, [route]);

  const library = () => void navigation.navigate({kind: 'library'});
  const newScenario = () => void navigation.navigate({kind: 'editor'}, () => {
    controller.startNewScenario(); setStarting(undefined); setSourceFile(undefined); setNotice(undefined);
    setEditorGeneration(value => value + 1); setRoute({kind: 'editor'});
  });
  const importFile = (file: File) => void navigation.navigate({kind: 'editor'}, () => {
    controller.openEditor(); setStarting(undefined); setSourceFile(file); setNotice(undefined);
    setEditorGeneration(value => value + 1); setRoute({kind: 'editor'});
  });
  const startSetup = (scenario: ValidatedScenario) => void navigation.navigate({kind: 'setup'}, () => {
    controller.openEditor(); setRoute({kind: 'setup'}); setStarting(scenario); setNotice(undefined);
  });
  const restart = () => void navigation.navigate({kind: 'setup'}, () => {
    controller.restartFromSetup(); setRoute({kind: 'setup'}); setNotice(undefined);
  });
  const busy = state.busy || !!starting;
  const editorVisible = route.kind === 'editor' && state.screen === 'editor';
  return <div className="customGrimoireApplication">
    <div hidden={!editorVisible} inert={busy || state.saveFailed}>
      <CustomScenarioEditor key={editorGeneration} active={editorVisible} sourceFile={sourceFile} onExit={onExit}
        onSavedGames={library} onNewGrimoire={startSetup} onResume={game => void controller.resumeImported(game)}/>
    </div>
    {state.screen === 'library' && <CustomSavedGames notice={notice} onNewScenario={newScenario} onImport={importFile}
      onResume={gameId => void navigation.navigate({kind: 'game', gameId})}/>}
    {state.screen === 'setup' && controller.setup && <CustomGrimoireSetup key={controller.setup.getSnapshot().definition.id}
      controller={controller.setup} onNewGame={() => startSetup({definition: controller.setup!.getSnapshot().definition})}
      onNewScenario={newScenario} onImport={importFile} onSavedGames={library}/>}
    {state.screen === 'play' && controller.play && <CustomGrimoirePlay key={controller.play.getSnapshot().file.game.id}
      controller={controller.play} onRestart={restart} onNewGame={() => startSetup({definition: controller.play!.getSnapshot().file.game.script.definition})}
      onNewScenario={newScenario} onImport={importFile} onSavedGames={library}/>}
    {state.error && <aside className="customRouteRecovery" role="alert"><p>{state.error}</p><nav aria-label="게임 복구">
      {state.saveFailed ? <button type="button" disabled={busy} onClick={() => void controller.retrySave()}>저장 다시 시도</button>
        : <><button type="button" disabled={busy} onClick={() => {
          if (route.kind === 'game') void controller.restoreGame(route.gameId);
          else if (initial.legacyId) void controller.restoreLegacy(initial.legacyId);
        }}>다시 시도</button><button type="button" disabled={busy} onClick={library}>자동 저장 목록</button>
        <button type="button" disabled={busy} onClick={() => recoveryInput.current?.click()}>JSON 불러오기</button></>}
    </nav></aside>}
    <input type="file" hidden ref={recoveryInput} accept=".json,application/json" aria-label="복구 JSON 파일" onChange={event => {
      const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) importFile(file);
    }}/>
    {busy && <div className="customGrimoireLoading" role="status"><span aria-hidden="true">☾</span><strong>{starting?.definition.name ?? '마도서'} 준비 중</strong></div>}
  </div>;
}
