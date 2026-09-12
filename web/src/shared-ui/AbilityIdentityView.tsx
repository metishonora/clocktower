import type {ReactNode} from 'react';
export function AbilityOwnerView({icon,role,player,wrap}:{icon:ReactNode;role:ReactNode;player:ReactNode;wrap:(children:ReactNode)=>ReactNode}){return wrap(<>{icon}<div>{role}{player}</div></>);}
export function ActingAbilityView({label,icon,name,status,summary,wrap}:{label:string;icon:ReactNode;name:ReactNode;status?:ReactNode;summary?:string;wrap:(children:ReactNode)=>ReactNode}){return wrap(<><span>{label}</span>{icon}<div>{name}{status}{summary?<p>{summary}</p>:null}</div></>);}
