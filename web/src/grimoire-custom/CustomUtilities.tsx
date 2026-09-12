import {GameStorageView} from '../shared-ui/GameStorageView';
import { type ReactNode, useRef, useState } from 'react';
import { GameConfirmationDialog } from '../shared-ui/GameConfirmationDialog';
import type { CustomScriptDefinition, GameFileV4 } from '../custom/core/types';
import { serializeScenarioFile } from '../custom/storage/scenarioFile';
import { exportGameFileJson } from '../custom/storage/gameFile';
import { downloadScenarioFile } from '../custom/authoring/browserScenarioFiles';
import { GameBugReportDialog, type BugReportBuildInput, type BugReportResult } from '../features/bug-report/GameBugReportDialog';
import { currentBugReportEnvironment, DEFAULT_BUG_REPORT_EMAIL } from '../bugReportDelivery';
import type { WorkflowDestination } from '../shared-ui/ProductionApplicationShell';

export type CustomUtilityActions = { onNewGame: () => void; onNewScenario?: () => void; onImport: (file:File) => void };
type ReportContext = { eventCount:number; phase:string };
type ReportSource = {definition:CustomScriptDefinition; file?:GameFileV4};
export function buildCustomReport({gameFile:source,symptom,environment,reproductionContext,includeOriginalGameFile}:BugReportBuildInput<ReportContext,ReportSource>):BugReportResult<ReportContext,ReportSource> {
  const fixture:ReportSource = JSON.parse(JSON.stringify(source, (key,value) => {
    if (key === 'name') return '익명';
    if (/note|memo/i.test(key)) return undefined;
    if (key === 'summary') return '확정 행동';
    return value;
  }));
  const metadata = {reportSchemaVersion:1,schemaVersion:source.file?.schemaVersion ?? 1,scriptId:'custom',...environment,viewport:`${environment.viewport.width}×${environment.viewport.height}`,gameUpdatedAt:source.file?.game.updatedAt ?? '',eventCount:source.file?.game.events.length ?? 0};
  const attachmentJson = JSON.stringify({type:'clocktower.custom.bug-report',metadata,symptom,reproductionContext,fixture,...(includeOriginalGameFile?{original:source}:{})},null,2);
  return {subject:'[Clocktower Custom] 버그 제보',body:attachmentJson,attachmentJson,metadata,fixture,reproductionContext,reportType:'clocktower.custom.bug-report',reportSchemaVersion:1};
}
export function useCustomUtilities({definition,file,busy,onNewGame,onNewScenario,onImport,history}:{history?:ReactNode;definition:CustomScriptDefinition;file?:GameFileV4;busy:boolean}&CustomUtilityActions) {
  const [confirmNewScenario,setConfirmNewScenario] = useState(false);
  const [confirmNewGame,setConfirmNewGame] = useState(false);
  const [open,setOpen] = useState<'storage'|'bug-report'>();
  const [error,setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const download = (game:boolean) => {try {downloadScenarioFile(game && file ? exportGameFileJson(file) : serializeScenarioFile({definition}),`${definition.name.replace(/[\\/:*?"<>|]/g,'_')}-${game?'game':'scenario'}.json`);setError('');}catch{setError('JSON을 저장하지 못했습니다. 다시 시도하세요.');}};
  const destinations:WorkflowDestination[] = [
    {id:'new-game',label:'새 게임',className:'snvNewGameTab',disabled:busy,onSelect:()=>setConfirmNewGame(true)},
    ...(onNewScenario ? [{id:'new-scenario',label:'새 시나리오',className:'snvNewGameTab',disabled:busy,onSelect:()=>setConfirmNewScenario(true)}] : []),
    {id:'storage',label:'저장 / 불러오기',className:`snvStorageTab ${open==='storage'?'active':''}`,active:open==='storage',disabled:busy,onSelect:()=>setOpen('storage')},
    {id:'bug-report',label:'버그 제보',className:'snvBugReportTrigger',disabled:busy,onSelect:()=>setOpen('bug-report')},
  ];
  return {destinations,close:()=>setOpen(undefined),storageOpen:open==='storage',content:<>
    {confirmNewGame && <GameConfirmationDialog label="새 게임 확인" title="새 게임을 시작할까요?" description="현재 직업 선택, 좌석과 진행 상태가 모두 초기화됩니다." confirmLabel="새 게임" onCancel={()=>setConfirmNewGame(false)} onConfirm={()=>{if(busy)return;setConfirmNewGame(false);setOpen(undefined);onNewGame();}}/>}
    {confirmNewScenario && <GameConfirmationDialog label="새 시나리오 확인" title="새 시나리오를 작성할까요?" description="현재 화면을 닫고 빈 시나리오 작성 화면으로 돌아갑니다. 기존 자동 저장은 유지됩니다." confirmLabel="새 시나리오 작성" onCancel={()=>setConfirmNewScenario(false)} onConfirm={()=>{if(busy)return;setConfirmNewScenario(false);setOpen(undefined);onNewScenario?.();}}/>}
    <input ref={input} hidden type="file" accept=".json,application/json" aria-label="마도서 JSON 파일" onChange={e=>{const next=e.currentTarget.files?.[0];e.currentTarget.value='';if(next){setOpen(undefined);onImport(next);}}}/>
    {open==='storage' && <section className="customBmrStorage snvTabPanel" aria-label="저장 / 불러오기">
      <GameStorageView canExport busy={busy} onExport={()=>download(!!file)} onImport={()=>input.current?.click()} description="시나리오 또는 게임 파일을 검토합니다."/>
      {history}
      {error && <p role="alert">{error}</p>}
    </section>}
    {open==='bug-report' && <GameBugReportDialog theme={{id:'bad-moon-rising',classPrefix:'bmr'}} gameFile={{definition,file}} environment={currentBugReportEnvironment()} reproductionContext={{eventCount:file?.game.events.length ?? 0,phase:file?'play':'setup'}}
      recipient={DEFAULT_BUG_REPORT_EMAIL} onClose={()=>setOpen(undefined)} builder={buildCustomReport} scriptName="Clocktower Custom" scriptId="custom" downloadPrefix="clocktower-custom-bug-report-" showBrandName={false}
      privacyExcluded="플레이어·시나리오 이름과 메모" originalFileLabel="원본 게임 JSON도 포함" />}
  </>};
}
