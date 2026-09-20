import type {ReactNode} from 'react';
import './styles/evilInformationReveal.css';
type RevealPlayer = {seat:number;name:string};
function PlayerGroup({label,players,marionette=false}:{label:string;players:RevealPlayer[];marionette?:boolean}) {
 return <section aria-label={label} className={marionette?'bmrRevealMarionettes':undefined}><h2>{label}</h2><div className="bmrRevealPlayers">{players.map(player=><article key={player.seat}><span>{player.seat}</span><strong>{player.name}</strong></article>)}</div></section>;
}
export function EvilInformationRevealContent({minion,players,bluffs,marionettePlayers=[]}:{minion:boolean;players:RevealPlayer[];bluffs:{id:string;label:string;icon:ReactNode}[];marionettePlayers?:RevealPlayer[]}) {
 const ordinary=<PlayerGroup label={minion?'악마':'하수인'} players={players}/>;
 return <><h1>{minion?"당신은 하수인입니다":"당신은 악마입니다"}</h1>{!minion&&marionettePlayers.length>0?<div className="bmrRevealTeamGroups">{players.length>0&&ordinary}<PlayerGroup label="꼭두각시" players={marionettePlayers} marionette/></div>:ordinary}{!minion&&<section><h2>속임수</h2><div className="bmrRevealBluffs">{bluffs.map(bluff=><article key={bluff.id}>{bluff.icon}<strong>{bluff.label}</strong></article>)}</div></section>}</>;
}
