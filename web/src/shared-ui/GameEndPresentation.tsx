import {useEffect,useRef} from 'react';
import './styles/gameEnd.css';
type Outcome={winningTeam:'good'|'evil';reason?:string};
export const gameEndTitle=(team:Outcome['winningTeam'])=>`${team==='good'?'선':'악'} 진영 승리`;

export function GameEndDialog({winningTeam,reason,busy,error,onConfirm}:Outcome&{busy:boolean;error?:string;onConfirm:()=>void}) {
 const dialog=useRef<HTMLElement>(null);
 useEffect(()=>{
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:undefined;
  const element=dialog.current;
  element?.focus();
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Tab') {event.preventDefault();(element?.querySelector<HTMLButtonElement>('button:not(:disabled)')??element)?.focus();}
  };
  element?.addEventListener('keydown',key);
  return ()=>{element?.removeEventListener('keydown',key);if(previous?.isConnected)previous.focus();};
 },[]);
 return <div className="snvGameEndOverlay" data-team={winningTeam}>
  <section ref={dialog} tabIndex={-1} className="snvGameEndDialog" data-team={winningTeam} role="dialog" aria-modal="true" aria-label={gameEndTitle(winningTeam)}>
   <h2>{gameEndTitle(winningTeam)}</h2><p>{reason}</p>
   {error&&<p role="alert">{error}</p>}
   <button type="button" disabled={busy} onClick={onConfirm}>{busy?'종료 중…':'게임 종료'}</button>
  </section>
 </div>;
}
export function GameEndDock({winningTeam,reason}:Outcome) {
 return <aside className="snvGameEndDock" data-team={winningTeam} role="region" aria-label="게임 종료 상태">
  <span className="snvGameEndMark" aria-hidden="true">{winningTeam==='good'?'선':'악'}</span>
  <div><strong>{gameEndTitle(winningTeam)}</strong>{reason&&<p>{reason}</p>}</div>
 </aside>;
}
export function EndedGameView({winningTeam,reason,onGrimoire}:Outcome&{onGrimoire:()=>void}) {
 return <section className="snvEndedPlaySurface snvTabPanel" aria-label="종료된 게임">
  <span aria-hidden="true">{winningTeam==='good'?'선':'악'}</span><h2>{gameEndTitle(winningTeam)}</h2>
  {reason&&<p>{reason}</p>}<button type="button" onClick={onGrimoire}>마도서 보기</button>
 </section>;
}
