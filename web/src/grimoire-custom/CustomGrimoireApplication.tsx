import { useEffect, useState, useSyncExternalStore } from 'react';
import { CustomScenarioEditor } from '../custom/authoring/CustomScenarioEditor';
import { CustomGrimoireApplicationController } from '../custom/grimoire/applicationController';
import { activeCustomSessionId, rememberCustomSession, forgetCustomSessionNavigation } from '../custom/grimoire/browserSessionNavigation';
import { wasmCoreAdapter } from '../custom/core/wasmClient';
import type { ValidatedScenario } from '../custom/core/definitionValidator';
import { CustomGrimoireSetup } from './CustomGrimoireSetup';
import { CustomGrimoirePlay } from './CustomGrimoirePlay';
import './customGrimoirePlay.css';
export function CustomGrimoireApplication({ onExit }: { onExit: () => void }) {
  const [controller] = useState(()=>new CustomGrimoireApplicationController(wasmCoreAdapter, rememberCustomSession));
  const state = useSyncExternalStore(controller.subscribe,controller.getSnapshot);
  const [sourceFile,setSourceFile] = useState<File>();
  const importFile = (file: File) => { setSourceFile(file); controller.openEditor(); };
  const [starting,setStarting] = useState<ValidatedScenario>();
  const [restoreId,setRestoreId] = useState(activeCustomSessionId);
  const [editorGeneration,setEditorGeneration] = useState(0);
  const newScenario = () => {
    if (!controller.startNewScenario()) return;
    setStarting(undefined); setSourceFile(undefined); setRestoreId(undefined);
    setEditorGeneration(value=>value+1); forgetCustomSessionNavigation();
  };
  useEffect(()=>{if(restoreId) void controller.restore(restoreId);},[controller,restoreId]);
  useEffect(()=>controller.dispose,[controller]);
  useEffect(()=>{
    if(!starting) return;
    const timer=window.setTimeout(()=>{controller.startSetup(starting);setStarting(undefined);}, window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:820);
    return ()=>window.clearTimeout(timer);
  },[starting,controller]);
  const busy=state.busy || !!starting;
  return <div className="customGrimoireApplication">
    <div hidden={state.screen!=='editor'} inert={busy || state.saveFailed}><CustomScenarioEditor key={editorGeneration} sourceFile={sourceFile} onExit={()=>{forgetCustomSessionNavigation();onExit();}} onNewGrimoire={setStarting} onResume={game=>void controller.resumeImported(game)}/></div>
    {state.screen==='setup' && controller.setup && <CustomGrimoireSetup controller={controller.setup} onNewGame={() => controller.startSetup({definition:controller.setup!.getSnapshot().definition})} onNewScenario={newScenario} onImport={importFile}/>}
    {state.screen==='play' && controller.play && <CustomGrimoirePlay onRestart={controller.restartFromSetup} controller={controller.play} onNewGame={() => controller.startSetup({definition:controller.play!.getSnapshot().file.game.script.definition})} onNewScenario={newScenario} onImport={importFile}/>}
    {state.error && <aside className="customApplicationError" role="alert"><p>{state.error}</p>{state.saveFailed ? <button type="button" disabled={busy} onClick={()=>void controller.retrySave()}>저장 다시 시도</button> : restoreId && <button type="button" disabled={busy} onClick={()=>void controller.restore(restoreId)}>복원 다시 시도</button>}</aside>}
    {busy && <div className="customGrimoireLoading" role="status"><span aria-hidden="true">☾</span><strong>{starting?.definition.name ?? '마도서'} 준비 중</strong></div>}
  </div>;
}
