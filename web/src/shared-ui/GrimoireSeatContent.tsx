import type {ReactNode} from 'react';
import {FuneralIcon,GhostVoteIcon} from '../features/grimoire/SeatStateIcons';
/** The existing TB seat content, including read-only Spy token labels. */
export function GrimoireSeatContent({seat,name,icon,alive,ghostVoteUsed,label,tokenLabels=[]}:{seat:number;name:string;icon:ReactNode;alive:boolean;ghostVoteUsed?:boolean;label:string;tokenLabels?:string[]}) {
 const replaceIcon=!alive&&ghostVoteUsed!==undefined;
 return <><span className="snvSeatNumber">{seat}</span>{replaceIcon?<span className="snvDeathSeatIcon">{ghostVoteUsed?<FuneralIcon/>:<GhostVoteIcon/>}</span>:icon}{!alive&&!replaceIcon?<FuneralIcon/>:null}<span className="snvSeatPlayerName">{name}</span><small>{label}</small>{tokenLabels.length?<span className="tbRevealTokenList" aria-label="적용 토큰">{tokenLabels.map(label=><span key={label}>{label}</span>)}</span>:null}</>;
}
