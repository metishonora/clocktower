import { Fragment, type ReactNode } from 'react';
type Twin = { playerId: string; seat: number; name: string; characterId: string; alignment: string };
export function EvilTwinRevealContent({players,label,icon}:{players:readonly Twin[];label:(id:string)=>string;icon:(id:string)=>ReactNode}) {
 return <><span>사악한 쌍둥이</span><h2>여러분은 쌍둥이입니다</h2><p>상대와 직업을 확인하십시오</p><div className="evilTwinRevealPair">{players.map((player,index)=><Fragment key={player.playerId}>{index>0?<b aria-hidden="true">↔</b>:null}<article className={`evilTwinRevealIdentity alignment-${player.alignment}`}><span>{player.seat}번 · {player.name}</span>{icon(player.characterId)}<strong>{player.alignment==='good'&&player.characterId==='evilTwin'?'쌍둥이':label(player.characterId)}</strong><small>{player.alignment==='good'?'선':'악'}</small></article></Fragment>)}</div></>;
}
