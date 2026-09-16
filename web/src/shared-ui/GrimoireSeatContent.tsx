import type {ReactNode} from 'react';
import {FuneralIcon} from '../features/grimoire/SeatStateIcons';
/** The existing TB seat content, including read-only Spy token labels. */
export function GrimoireSeatContent({seat,name,icon,alive,label,tokenLabels=[]}:{seat:number;name:string;icon:ReactNode;alive:boolean;label:string;tokenLabels?:string[]}) {
 return <><span className="snvSeatNumber">{seat}</span>{icon}{!alive?<FuneralIcon/>:null}<span className="snvSeatPlayerName">{name}</span><small>{label}</small>{tokenLabels.length?<span className="tbRevealTokenList" aria-label="적용 토큰">{tokenLabels.map(label=><span key={label}>{label}</span>)}</span>:null}</>;
}
