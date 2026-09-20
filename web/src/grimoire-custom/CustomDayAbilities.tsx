import {useEffect,useState} from 'react';
import {characterPresentation} from '../custom/authoring/characterPresentation';
import type {DayAbilityAction,DayAbilityInput,DayView} from '../custom/core/dayTypes';
import type {Player} from '../custom/core/types';
import type {FirstNightController} from '../custom/grimoire/firstNightController';
import {MadnessActionView} from '../shared-ui/MadnessActionView';
import {ArtistForm,SavantForm,JugglerForm,type InformationInfluence} from '../shared-ui/DayAbilityForms';
import '../features/day-actions/dayActionDock.css';
export function CustomDayAbilities({day,players,controller,busy}:{day:DayView;players:Player[];controller:FirstNightController;busy:boolean}){
 const [selected,setSelected]=useState<string>();
 const [group,setGroup]=useState<'day'|'madness'>();
 const action=group==='day'?day.availableActions.find(a=>a.id===selected):undefined;
 const player=players.find(p=>p.id===action?.actorPlayerId);
 const role=action?characterPresentation(action.characterId):undefined;
 const influence:InformationInfluence|undefined=action?.vortox?'vortox':action?.impaired?(controller.getSnapshot().replay.ruleState.activeImpairments?.some(i=>i.playerId===action.actorPlayerId&&i.kind==='poisoned')?'poisoned':'drunk'):undefined;
 useEffect(()=>{if(selected&&!day.availableActions.some(a=>a.id===selected))setSelected(undefined);},[selected,day.availableActions]);
 const submit=async(record:DayAbilityInput)=>{if(!action)return;await controller.confirmDay({kind:'useAbility',actionId:action.id,record});if(!controller.getSnapshot().error){setSelected(undefined);setGroup(undefined);}};
 return <>
 {day.availableActions.length>0&&<>
 <div className={`snvDayActionScrollClearance${action?' open':''}`} aria-hidden="true"/>
 {action&&player&&role&&<section className={`snvDayActionPanel snvDayActionPanel--${action.characterId}${action.characterId==='slayer'?' tbSlayerActionPanel':''}`} role="dialog" aria-label={`${role.label} 능력 사용`}>
 <header className="snvDayActionHeader"><div className="snvDayActionIdentity"><img src={role.image} alt=""/><div><span>{day.day}일차 낮 · {player.seat}번 {player.name}</span><span className="snvDayActionRoleLine"><h2>{role.label}</h2>{influence&&<em className={`snvInformationInfluenceBadge ${influence}`}>{influence==='vortox'?'보르톡스':influence==='poisoned'?'중독':'취함'}</em>}</span>{(action.simulationSource||player.actualCharacter!==action.characterId)&&<small>{characterPresentation(player.actualCharacter)?.label} · {action.simulationSource?'안내 능력':'획득 능력'}</small>}</div></div><p>{role.ability}</p></header>
 <fieldset className="customDayFormLock" disabled={busy} key={action.id}>
 {action.characterId==='artist'?<ArtistForm influence={influence} busy={busy} onComplete={record=>void submit(record)}/>:action.characterId==='savant'?<SavantForm influence={influence} busy={busy} onComplete={record=>void submit(record)}/>:action.characterId==='juggler'?<JugglerForm busy={busy} onComplete={record=>void submit(record)}/>:<SlayerForm action={action} players={players} registrationTargetIds={day.demonRegistrationTargetIds} busy={busy} onSubmit={record=>void submit(record)}/>}
 </fieldset></section>}
 <div className="snvDayActionDock" aria-label="사용 가능한 낮 자유 행동">{day.availableActions.map(a=>{const role=characterPresentation(a.characterId)!,p=players.find(p=>p.id===a.actorPlayerId)!;const active=action?.id===a.id;return <button key={a.id} type="button" className={active?'selected':''} aria-label={active?`${role.label} 행동 창 닫기`:`${role.label} 행동 열기, ${p.seat}번 ${p.name}`} aria-expanded={active} disabled={busy} onClick={()=>{setSelected(active?undefined:a.id);setGroup(active?undefined:'day');}}>{active?<span aria-hidden="true">×</span>:<img src={role.image} alt=""/>}</button>;})}</div>
 </>}
  <MadnessActionView players={players} assignments={day.madness.map(a=>{const role=characterPresentation(a.observerCharacterId??a.source.characterId)!;return {assignmentId:a.id,sourcePlayerId:a.source.ownerPlayerId,targetPlayerId:a.targetPlayerId,sourceCharacterId:role.id as 'mutant'|'cerenovus'|'pixie',requiredCharacterId:a.characterId??undefined,requiredCharacterLabel:a.characterId?characterPresentation(a.characterId)?.label:undefined,status:a.violation===true?'violated' as const:a.violation===false?'clear' as const:'unchecked' as const,sourceEffective:a.effective,canCheck:a.canCheck,canExecute:a.canExecute,sourceLabel:role.label,iconSrc:role.image,ability:role.ability};})} groupActive={group==='madness'} onGroupActivate={()=>{setSelected(undefined);setGroup('madness');}} onGroupDeactivate={()=>setGroup(undefined)} phaseLabel={`${day.day}일차 낮`} theme="day" precedingActionCount={day.availableActions.length} busy={busy} executionDescription="처형을 확정하면 낮 진행이 종료됩니다." renderIdentity={(_id,_theme,children)=><div className="snvMadnessIdentity">{children}</div>} onJudge={(assignmentId,result)=>void controller.confirmDay({kind:'checkMadness',assignmentId,violation:result==='violation'})} onExecute={assignmentId=>void controller.confirmDay({kind:'executeMadness',assignmentId})}/> </>;
}
function SlayerForm({action,players,registrationTargetIds,busy,onSubmit}:{action:DayAbilityAction;players:Player[];registrationTargetIds:string[];busy:boolean;onSubmit:(record:DayAbilityInput)=>void}){
 const [target,setTarget]=useState(''),[registration,setRegistration]=useState<'canonical'|'demon'>();
 const needsRegistration=registrationTargetIds.includes(target);
 return <div className="snvDayActionForm tbSlayerActionForm"><fieldset className="tbSlayerTargets"><legend>대상</legend><div>{players.map(p=><button key={p.id} type="button" className={target===p.id?'selected':''} aria-label={`${p.seat}번 ${p.name}${p.alive?'':' · 사망'}`} aria-pressed={target===p.id} onClick={()=>{setTarget(p.id);setRegistration(undefined);}}><span>{p.seat}</span><strong>{p.name}</strong>{!p.alive&&<small>사망</small>}</button>)}</div></fieldset>
 {needsRegistration&&<fieldset className="tbSlayerRegistration"><legend>이번 판정의 은둔자 취급</legend><div><button type="button" className={registration==='canonical'?'selected':''} aria-pressed={registration==='canonical'} onClick={()=>setRegistration('canonical')}>악마로 취급하지 않음</button><button type="button" className={registration==='demon'?'selected':''} aria-pressed={registration==='demon'} onClick={()=>setRegistration('demon')}>악마로 취급</button></div></fieldset>}
 <button type="button" className={`snvDayActionConfirm ${action.impaired?'drunk':'normal'}`} disabled={busy||!target||(needsRegistration&&!registration)} onClick={()=>onSubmit({kind:'slayer',targetPlayerId:target,recluseAsDemon:registration==='demon'})}>처단자 능력 사용</button></div>;
}
