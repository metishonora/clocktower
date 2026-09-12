import type {ReactNode} from 'react';
export function EvilInformationRevealContent({minion,players,bluffs}:{minion:boolean;players:{seat:number;name:string}[];bluffs:{id:string;label:string;icon:ReactNode}[]}) {
 return <><h1>{minion?"당신은 하수인입니다":"당신은 악마입니다"}</h1><section><h2>{minion?'악마':'하수인'}</h2><div className="bmrRevealPlayers">{players.map(player=><article key={player.seat}><span>{player.seat}</span><strong>{player.name}</strong></article>)}</div></section>{!minion&&<section><h2>속임수</h2><div className="bmrRevealBluffs">{bluffs.map(bluff=><article key={bluff.id}>{bluff.icon}<strong>{bluff.label}</strong></article>)}</div></section>}</>;
}
