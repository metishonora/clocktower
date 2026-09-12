import { useSyncExternalStore } from 'react';
import { phaseOverviewLabel, stepLabel } from '../custom/grimoire/historyModel';
import type { FirstNightController } from '../custom/grimoire/firstNightController';

/** TB's status + compact role list, retaining BMR theme and custom step identities. */
export function CustomPhaseOrder({controller}:{controller:FirstNightController}) {
  const state=useSyncExternalStore(controller.subscribe,controller.getSnapshot);
  const step=controller.step;
  return <section className="customPhaseOrder" aria-label="첫날 밤 행동">
    <ol className="snvPhaseOverview bmrPhaseOrder" aria-label="진행 순서">{groupedOverview(state.replay).map((s,i)=>{
      const active=s.execution.id===step?.execution.id;
      return <li key={`${s.id}:${i}`} className={active?'current':s.status==='complete'?'complete':''} aria-current={active?'step':undefined} title={stepLabel(s,state.replay)}>
        <span>{active?'현재':({waiting:'대기',current:'대기',complete:'완료',skipped:'건너뜀',needsFollowUp:'후속',interrupted:'중단',manualComplete:'완료',notApplicable:'해당 없음'})[s.status]}</span>
        <span className="snvPhaseOverviewAction"><strong>{phaseOverviewLabel(s,state.replay)}</strong></span>
      </li>;
    })}</ol>
  </section>;
}

function groupedOverview(replay:import('../custom/core/types').ReplayState) {
 const rows=replay.phaseOverview;
 // Execution units define grouping; phaseOverview defines the Core scenario order.
 const executions=[...replay.actionExecutions].sort((a,b)=>rows.findIndex(row=>a.stepIds.includes(row.id))-rows.findIndex(row=>b.stepIds.includes(row.id)));
 return executions.flatMap(execution=>{
  const members=rows.filter(row=>execution.stepIds.includes(row.id));
  if(!members.length||members.every(row=>row.actionCause?.kind==='optional'))return [];
  const displayed=members.find(row=>row.id===execution.displayStepId)??members.at(-1)!;
  const status=execution.status==='interrupted'?'interrupted':members.some(row=>row.status==='current')?'current':members.every(row=>row.status==='complete')?'complete':'waiting';
  return [{...displayed,status} as typeof displayed];
 });
}
