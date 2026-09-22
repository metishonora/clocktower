import type {RevealPayload} from '../custom/core/types';
import {GrimoireNotificationPrompt} from '../shared-ui/GrimoireHandoffView';
export function CustomNotificationPrompt({payload,players,sequence,total,onReveal}:{payload:RevealPayload;players:readonly {id:string;seat:number;name:string}[];sequence:number;total:number;onReveal:()=>void}) {
  if(!('kind' in payload))return null;
  if(payload.kind==='preacherInformation')return <section className="snakeCharmerRevealPrompt" role="dialog" aria-label="전도사 통지"><strong>전도사 통지</strong><p>{payload.recipientPlayer.seat}번 {payload.recipientPlayer.name}</p><button type="button" onClick={onReveal}>공개</button></section>;
  if(payload.kind==='marionetteInformation')return <section className="snakeCharmerRevealPrompt" role="dialog" aria-label={`꼭두각시 통지 ${sequence}/${total}`}><strong>꼭두각시 통지</strong><p>{payload.recipientPlayer.seat}번 {payload.recipientPlayer.name}</p><button type="button" onClick={onReveal}>공개</button></section>;
  if(payload.kind==='grantedAbilityInformation')return <section className="snakeCharmerRevealPrompt" role="dialog" aria-label={`능력 통지 ${sequence}/${total}`}><strong>능력 통지</strong><p>{payload.recipientPlayer.seat}번 {payload.recipientPlayer.name}</p><button type="button" onClick={onReveal}>공개</button></section>;
  if(!['madnessAssignment','characterChange','evilTwinPair','nightwatchmanInformation'].includes(payload.kind))return null;
  const player='recipientPlayer' in payload?payload.recipientPlayer:'playerId' in payload?players.find(p=>p.id===payload.playerId):undefined;
  return <GrimoireNotificationPrompt kind={payload.kind as 'madnessAssignment'|'characterChange'|'evilTwinPair'|'nightwatchmanInformation'} players={payload.kind==='evilTwinPair'?payload.players:[]} sequence={sequence} total={total} playerLabel={player?`${player.seat}번 ${player.name}`:'플레이어'} onReveal={onReveal}/>;
}
