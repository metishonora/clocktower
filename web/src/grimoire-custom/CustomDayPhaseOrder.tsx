import {useSyncExternalStore} from 'react';
import type {FirstNightController} from '../custom/grimoire/firstNightController';
import type {DayStage} from '../custom/core/dayTypes';
const stages:DayStage[]=['announcement','whisper','discussion','nomination','execution','executionDeath','nightReady'];
const labels=['사망 발표','밀담','공개 토론','지명 및 투표','처형 결정','사망 확인','밤으로'];
function index(stage:DayStage){return stage==='voting'?3:stage==='death'?3:stage==='night'?7:stages.indexOf(stage);}
export function CustomDayPhaseOrder({controller}:{controller:FirstNightController}){
  const state=useSyncExternalStore(controller.subscribe,controller.getSnapshot),day=state.replay.day!;
  const current=index(day.stage),visited=new Set([0]);
  for(const event of state.file.game.events)if(event.type==='dayConfirmed'&&event.payload.day===day.day)visited.add(index(event.payload.result.stage));
  return <ol className="snvPhaseOverview bmrPhaseOrder" aria-label="낮 순서">{stages.map((stage,i)=>{
    const active=i===current&&!state.replay.gameEnd;
    const passed=i<current||!!state.replay.gameEnd;
    const status=active?'현재':passed?visited.has(i)?'완료':'종료':'대기';
    return <li key={stage} className={active?'current':passed?'complete':''} aria-current={active?'step':undefined}><span>{status}</span><span className="snvPhaseOverviewAction"><strong>{i===3&&day.stage==='death'?'지명 중 사망 확인':labels[i]}</strong></span></li>;
  })}</ol>;
}
