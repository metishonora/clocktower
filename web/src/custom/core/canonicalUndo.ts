import type { GameEvent, GameFile, ReplayState } from './types.js';
export type CanonicalUndoUnit = {id:string;eventIds:string[];summary:string;summaryStepId:string;executionId:string};
export type LiveUndoTarget = CanonicalUndoUnit & {events:GameEvent[]};

/** The Core owns membership. Missing or stale output is never replaced with click/event inference. */
export function latestCanonicalUndoUnit(file:GameFile,replay:ReplayState|undefined):CanonicalUndoUnit|undefined {
  const unit=replay?.latestUndoUnit;
  if (!unit || replay.eventCount!==file.game.events.length) return;
  const suffix=file.game.events.slice(-unit.eventIds.length);
  if (!suffix.length || suffix.some((event,index)=>event.id!==unit.eventIds[index]||event.type==='setupConfirmed') || suffix.at(-1)?.id!==unit.id) return;
  const execution=replay.actionExecutions.find(e=>e.id===unit.executionId);
  if (!execution || JSON.stringify(execution.eventIds)!==JSON.stringify(unit.eventIds)) return;
  const event=suffix.find(e=>e.type!=='setupConfirmed'&&e.payload.stepId===unit.summaryStepId)??suffix[0]!;
  return {...unit,eventIds:[...unit.eventIds],summary:event.summary};
}
export function removeLatestCanonicalUndoUnit(file:GameFile,expectedUnitId:string,replay:ReplayState|undefined):{gameFile:GameFile;removed:CanonicalUndoUnit}|undefined {
  const removed=latestCanonicalUndoUnit(file,replay);
  if (!removed || removed.id!==expectedUnitId) return;
  return {removed,gameFile:{...file,game:{...file.game,updatedAt:new Date().toISOString(),events:file.game.events.slice(0,-removed.eventIds.length)}}};
}
