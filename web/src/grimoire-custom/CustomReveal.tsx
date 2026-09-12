import {ProductionApplicationShell} from '../shared-ui/ProductionApplicationShell';
import {customPlayerTokens} from './customPlayerPresentation';
import {troubleBrewingCharacterDetail,sectsAndVioletsCharacterDetail} from '../characterDetails';
import {kindLabels} from '../custom/authoring/characterPresentation';
import {PlayerTokenCountBadge,PlayerTokenDetailDialog} from '../features/grimoire/playerTokenPresentation';
import '../features/reveal/sectsAndVioletsReveal.css';
import '../features/trouble-brewing/troubleBrewingRevealScreen.css';
import '../features/madness/cerenovusMadnessReveal.css';
import '../features/identity-change/characterChangeReveal.css';
import '../features/evil-twin/evilTwinReveal.css';
import '../shared-ui/styles/informationTask.css';
import '../shared-ui/styles/bmrRolePresentation.css';
import {EvilTwinRevealContent} from "../shared-ui/EvilTwinRevealContent";
import {SpyGrimoireView} from '../shared-ui/SpyGrimoireView';
import type {Ref} from 'react';
import {SnvInformationRevealContent} from '../shared-ui/SnvInformationRevealContent';
import {GrimoireSeatContent} from '../shared-ui/GrimoireSeatContent';
import {EvilInformationRevealContent} from '../shared-ui/EvilInformationRevealContent';
import { RoleRevealContent } from '../shared-ui/RoleRevealContent';
import { MadnessRevealContent } from '../shared-ui/MadnessRevealContent';
import { scalarInformationLabel, scalarInformationValueLabel } from '../shared-ui/scalarInformationPresentation';
import { grimoireHeights, rectangularSeatPositions } from '../shared-ui/GrimoirePresentation';
import type { CSSProperties } from 'react';
import type { SpyGrimoireRevealPayload } from '../custom/core/types';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BmrRevealSurface } from '../shared-ui/BmrRevealSurface';
import type { RevealPayload } from '../custom/core/types.js';
import { characterPresentation } from '../custom/authoring/characterPresentation.js';
/** This component receives only an allowlisted reveal payload, never a session or Storyteller state. */
export function CustomReveal({ payload, onClose }: { payload: RevealPayload; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    const root = document.getElementById('root');
    const wasInert = root?.inert ?? false;
    const previousVisibility = root?.style.visibility ?? '';
    if (root) { root.inert = true; root.style.visibility = 'hidden'; }
    close.current?.focus();
    const keys = (event: KeyboardEvent) => {
      if(document.querySelector('.playerTokenDetailDialog'))return;
      if('kind' in payload&&payload.kind==='spyGrimoire'&&event.key==='Tab'){
        const buttons=Array.from(document.querySelectorAll<HTMLButtonElement>('.bmrSpyRevealBackdrop button:not(:disabled)'));
        if(event.shiftKey&&document.activeElement===buttons[0]){event.preventDefault();buttons.at(-1)?.focus();}
        else if(!event.shiftKey&&document.activeElement===buttons.at(-1)){event.preventDefault();buttons[0]?.focus();}
        return;
      }
      if (event.key === 'Tab') { event.preventDefault(); close.current?.focus(); }
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    };
    document.addEventListener('keydown', keys, true);
    return () => { document.removeEventListener('keydown', keys, true); if (root) { root.inert = wasInert; root.style.visibility = previousVisibility; } previous?.focus(); };
  }, [onClose,payload]);
  if('kind' in payload&&payload.kind==='spyGrimoire')return createPortal(<div className="bmrRevealBackdrop bmrSpyRevealBackdrop"><ProductionApplicationShell title="마도서" eyebrow="STORYTELLER CONSOLE" ariaLabel="첩자 공개 화면" theme="night" className="bmrProductionShell customBmrTheme"
    classes={{header:'snvPrototypeHeader bmrHeader',eyebrow:'snvEyebrow',headerActions:'snvPhaseActions bmrHeaderActions',utilities:'snvUtilityTabs',stages:'snvSurfaceTabs'}}
    leading={<span className="bmrSkyDisc night" role="img" aria-label="밤 · 혈월"/>}
    utilities={[{id:'new-game',label:'새 게임',disabled:true},{id:'storage',label:'저장 / 불러오기',disabled:true},{id:'bug-report',label:'버그 제보',disabled:true}]}
    stages={[{id:'roles',label:'직업',disabled:true},{id:'seating',label:'마도서',active:true,disabled:true},{id:'play',label:'진행',disabled:true}]} onNavigate={()=>{}}>
    <SpyBoard payload={payload} onClose={onClose} closeRef={close}/>
  </ProductionApplicationShell></div>,document.body);
  return createPortal(<BmrRevealSurface variant={'kind' in payload && ['minionInformation','demonInformation'].includes(payload.kind)?'team':'role'} dialogLabel="플레이어 정보" className={revealClass(payload)} closeLabel="확인했으면 눈을 감으세요" closeButtonRef={close} onClose={onClose}><RevealContent payload={payload} /></BmrRevealSurface>, document.body);
}
function RevealContent({payload:p}:{payload:RevealPayload}) {
 if('kind' in p && p.kind==='evilTwinPair')return <EvilTwinRevealContent players={p.players} label={revealAssets.label} icon={revealAssets.icon}/>;
 if('kind' in p && (p.kind==='dreamerInformation'||p.kind==='seamstressInformation'||p.kind==='sageInformation'||p.kind==='booleanInformation'||p.kind==='numericInformation'&&characterPresentation(p.characterId)?.source==='sectsAndViolets'))return <SnvInformationRevealContent payload={p} label={revealAssets.label} icon={revealAssets.icon}/>;
 if('kind' in p && (p.kind==='minionInformation'||p.kind==='demonInformation'))return <EvilInformationRevealContent minion={p.kind==='minionInformation'} players={p.kind==='minionInformation'?p.demonPlayers:p.minionPlayers} bluffs={p.kind==='demonInformation'?p.bluffCharacterIds.map(id=>({id,label:characterPresentation(id)?.label ?? id,icon:<img src={characterPresentation(id)?.image} width={64} height={64} alt=""/>})):[]}/>;
 if ('kind' in p && p.kind==='spyGrimoire') return null;
 if ('kind' in p && p.kind==='madnessAssignment') {const role=characterPresentation(p.characterId);return <MadnessRevealContent characterName={role?.label ?? p.characterId} icon={<img src={role?.image} alt={role?.label}/>}/>;}
 if ('kind' in p && p.kind==='mutantExecution') return null; // Storyteller result, never a new player-facing reveal.
 return <RoleRevealContent payload={p} assets={revealAssets} onClose={()=>undefined}/>;
}
const ContentSurface=({children}:{children:React.ReactNode})=><>{children}</>;
const revealAssets={label:(id:string)=>characterPresentation(id)?.label ?? id,icon:(id:string,className?:string)=><img className={className} src={characterPresentation(id)?.image} alt=""/>,scalarLabel:scalarInformationLabel,scalarValue:scalarInformationValueLabel,Surface:ContentSurface};

function SpyBoard({payload,onClose,closeRef}:{payload:SpyGrimoireRevealPayload;onClose:()=>void;closeRef:Ref<HTMLButtonElement>}) {
 const [selected,setSelected]=useState<string>();
 const refs=useRef(new Map<string,HTMLButtonElement>());
 const player=payload.players.find(p=>p.playerId===selected),role=player&&characterPresentation(player.characterId);
 const desktop=rectangularSeatPositions(payload.players.length,false),mobile=rectangularSeatPositions(payload.players.length,true),heights=grimoireHeights(payload.players.length);
 const style={'--grimoire-height':`${heights.desktop}px`,'--mobile-grimoire-height':`${heights.mobile}px`} as CSSProperties;
 const tokens=(p:SpyGrimoireRevealPayload['players'][number])=>customPlayerTokens([
   ...(p.automaticReminders??[]),
   ...(p.reminderTokens??[]).filter(id=>!(p.automaticReminders??[]).some(t=>t.tokenId===id)).map(id=>({playerId:p.playerId,characterId:id==='poisoned'?'poisoner':'monk',tokenId:id,label:id==='poisoned'?'중독':'보호',description:''})),
 ]);
 return <><SpyGrimoireView title="마도서" ariaLabel="마도서 첩자 마도서" phaseLabel="첫날 밤" className="bmrGrimoireSurface customSpyBoard" boardClassName="bmrGrimoireBoard" style={style} onClose={onClose} closeRef={closeRef} seats={payload.players.map((p,index)=>({
  id:p.playerId,interactive:true,onSelect:()=>setSelected(p.playerId),buttonRef:node=>{if(node)refs.current.set(p.playerId,node);else refs.current.delete(p.playerId);},position:desktop[index],mobilePosition:mobile[index],
  afterSeat:<PlayerTokenCountBadge count={tokens(p).reduce((n,t)=>n+(t.count??1),0)} position={desktop[index]} mobilePosition={mobile[index]} theme="night"/>,
  className:`fixedSize assigned alignment-${p.alignment??'good'} kind-${characterPresentation(p.characterId)?.kind.toLowerCase()}${p.alive?'':' snvDeadSeat'}`,
  ariaLabel:`${p.seat}번 ${p.name}, ${characterPresentation(p.characterId)?.label}`,
  content:<GrimoireSeatContent seat={p.seat} name={p.name} alive={p.alive} label={characterPresentation(p.characterId)?.label??p.characterId} icon={<img src={characterPresentation(p.characterId)?.image} alt=""/>}/>,
 }))}/>{player&&role&&<PlayerTokenDetailDialog appearance="bmr" theme="night" onClose={()=>{setSelected(undefined);refs.current.get(player.playerId)?.focus();}}
  player={{characterId:role.id,seat:player.seat,name:player.name,characterLabel:role.label,characterKindLabel:kindLabels[role.kind],characterAbility:role.ability,characterIconSrc:role.image,alignment:player.alignment??'good'}}
  characterDetails={role.source==='troubleBrewing'?troubleBrewingCharacterDetail(role.id):sectsAndVioletsCharacterDetail(role.id)} tokens={tokens(player)}/>}</>;
}

function revealClass(p:RevealPayload):string {
 const base='customPublicReveal';
 if(!('kind' in p))return `${base} tbInformationReveal tb-textReveal`;
 if(p.kind==='evilTwinPair')return `${base} evilTwinReveal`;
 if(p.kind==='characterChange')return `${base} snakeCharmerReveal ${p.alignment}`;
 if(p.kind==='madnessAssignment')return `${base} cerenovusMadnessReveal`;
 if(p.kind==='dreamerInformation'||p.kind==='seamstressInformation'||p.kind==='sageInformation'||p.kind==='booleanInformation'||p.kind==='numericInformation'&&characterPresentation(p.characterId)?.source==='sectsAndViolets')return `${base} snvProductionInformationReveal`;
 if(p.kind==='minionInformation'||p.kind==='demonInformation')return base;
 return `${base} tbInformationReveal tb-${p.kind}`;
}
