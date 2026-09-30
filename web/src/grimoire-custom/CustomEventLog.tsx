import {useState} from 'react';
import {eventHistory,historyPhaseLabel,type EventHistoryRow} from '../custom/grimoire/eventPresentation';
import type {GameFileV5,ReplayState} from '../custom/core/types';
import './customEventHistory.css';

export function CustomEventLog({file,replay,rows}:{file:GameFileV5;replay?:ReplayState;rows?:EventHistoryRow[]}) {
  const history=rows??eventHistory(file,replay);
  return <section className="customEventHistory customFullHistory" aria-label="이벤트 로그">
    <header><h2>이벤트 로그</h2><span>{history.length}건</span></header>
    <div className="customHistoryScroll" tabIndex={0} aria-label="확정 이벤트 최신순"><HistoryGroups rows={[...history].reverse()}/></div>
    {!history.length&&<p>확정된 이벤트가 없습니다.</p>}
  </section>;
}
export function CustomPlayerHistory({rows,playerId}:{rows:EventHistoryRow[];playerId:string}) {
  const [expanded,setExpanded]=useState(false);
  const history=rows.filter(row=>row.playerIds.includes(playerId)).reverse();
  return <section className="customEventHistory customPlayerHistory" aria-label="플레이어 행동 기록">
    <header><h3>행동 기록</h3><span>{history.length}건</span></header>
    <HistoryGroups rows={expanded?history:history.slice(0,3)}/>
    {!history.length&&<p>아직 행동 기록이 없습니다.</p>}
    {history.length>3&&<button type="button" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?'최근 3건만 보기':`기록 더 보기 · ${history.length-3}건`}</button>}
  </section>;
}
function HistoryGroups({rows}:{rows:EventHistoryRow[]}) {
  const groups:{key:string;label:string;rows:EventHistoryRow[]}[]=[];
  for(const row of rows) {
    const key=`${row.phase}:${row.cycle??''}`;
    const last=groups.at(-1);
    if(last?.key===key)last.rows.push(row);
    else groups.push({key,label:historyPhaseLabel(row),rows:[row]});
  }
  return <>{groups.map(group=><section className="customHistoryGroup" key={`${group.key}:${group.rows[0].id}`} aria-label={group.label}>
    <h4>{group.label}</h4><ol role="list">{group.rows.map(row=><li key={row.id} data-event-id={row.id}>
      <p>{row.summary}</p>
      {!!row.details.length&&<details><summary>기록 상세</summary><div>{row.details.map((detail,index)=><p key={index}>{detail}</p>)}</div></details>}
    </li>)}</ol>
  </section>)}</>;
}
