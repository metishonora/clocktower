import type {ReplayState} from '../custom/core/types';
import {characterPresentation} from '../custom/authoring/characterPresentation';
export function CustomNightDeathSources({replay}:{replay:ReplayState}) {
 const sources=replay.nightDeaths?.sources??[];
 const person=(id:string|undefined)=>{const p=replay.players.find(p=>p.id===id);return p?`${p.seat}번${p.name===`${p.seat}번`?'':` ${p.name}`}`:'';};
 const labels=[...new Set(sources.map(source=>[characterPresentation(source.abilityUse.characterId??'')?.label,person(source.abilityUse.ownerPlayerId)].filter(Boolean).join(' · ')))];
 return labels.length?<p aria-label="예측불허의 죽음 유발자">유발: {labels.join(', ')}</p>:null;
}
