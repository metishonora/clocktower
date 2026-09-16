import type { ReactNode } from 'react';
export function EventHistoryList({events,renderAction}:{events:readonly {id:string;summary:string}[];renderAction?:(id:string)=>ReactNode}) {
return <section className="snvEventLog" aria-label="이벤트 로그"><header><h2>이벤트 로그</h2><strong>{events.length}건</strong></header>{events.length?<ol className="snvScrollableEventList" aria-label="확정 이벤트 최신순" tabIndex={0}>{[...events].reverse().map((event,index)=><li key={event.id}><span>{String(events.length-index).padStart(2,'0')}</span><p>{event.summary}</p>{renderAction?.(event.id)}</li>)}</ol>:<p className="snvEmptyEventLog">확정된 이벤트가 없습니다.</p>}</section>;
}
