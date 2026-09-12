import {afterEach,afterAll,expect,it,vi} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {CustomReveal} from '../src/grimoire-custom/CustomReveal';
import {TroubleBrewingRevealScreen} from '../src/features/trouble-brewing/TroubleBrewingRevealScreen';
import {SectsAndVioletsReveal} from '../src/features/reveal/SectsAndVioletsReveal';
import {SnvInformationRevealContent} from '../src/shared-ui/SnvInformationRevealContent';
import {CerenovusMadnessReveal} from '../src/features/madness/CerenovusMadnessReveal';
import {CharacterChangeReveal} from '../src/features/identity-change/CharacterChangeReveal';
import {EvilTwinReveal} from '../src/features/evil-twin/EvilTwinReveal';
import {characterPresentation} from '../src/custom/authoring/characterPresentation';
import type {RevealPayload} from '../src/custom/core/types';
const people=[{playerId:'p1',seat:1,name:'P1'},{playerId:'p2',seat:2,name:'P2'}] as [typeof person,typeof person];
const person={playerId:'p1',seat:1,name:'P1'};
const cases:Array<{name:string;payload:RevealPayload;source:'tb'|'snv'|'madness'|'change'|'twin'}>=[
 ...(['washerwoman','librarian','investigator'] as const).map(characterId=>({name:characterId,payload:{kind:'setupInformation' as const,characterId,candidatePlayers:people,revealedCharacterId:characterId==='librarian'?'saint':characterId==='investigator'?'poisoner':'monk',zeroOutsiders:false as const},source:'tb' as const})),
 {name:'librarian-zero',payload:{kind:'setupInformation',characterId:'librarian',candidatePlayers:[],zeroOutsiders:true},source:'tb'},
 ...(['chef','empath','clockmaker','mathematician','oracle','juggler'] as const).map(characterId=>({name:characterId,payload:{kind:'numericInformation' as const,characterId,value:2},source:characterId==='chef'||characterId==='empath'?'tb' as const:'snv' as const})),
 ...(['flowergirl','townCrier'] as const).flatMap(characterId=>[false,true].map(value=>({name:`${characterId}-${value}`,payload:{kind:'booleanInformation' as const,characterId,value},source:'snv' as const}))),
 ...[false,true].map(hasDemon=>({name:`fortuneTeller-${hasDemon}`,payload:{kind:'fortuneTellerInformation' as const,targetPlayers:people,hasDemon},source:'tb' as const})),
 ...(['undertaker','ravenkeeper'] as const).map(characterId=>({name:characterId,payload:{kind:'characterInformation' as const,characterId,targetPlayer:people[0],revealedCharacterId:'monk'},source:'tb' as const})),
 {name:'dreamer',payload:{kind:'dreamerInformation',characterIds:['dreamer','imp']},source:'snv'},
 ...[false,true].map(sameAlignment=>({name:`seamstress-${sameAlignment}`,payload:{kind:'seamstressInformation' as const,targetPlayers:people,sameAlignment},source:'snv' as const})),
 {name:'sage',payload:{kind:'sageInformation',candidatePlayers:people},source:'snv'},
 {name:'cerenovus',payload:{kind:'madnessAssignment',playerId:'p1',characterId:'dreamer'},source:'madness'},
 ...(['good','evil'] as const).map(alignment=>({name:`characterChange-${alignment}`,payload:{kind:'characterChange' as const,playerId:'p1',characterId:'evilTwin',alignment},source:'change' as const})),
 {name:'evilTwin',payload:{kind:'evilTwinPair',players:people.map((p,i)=>({...p,characterId:i?'evilTwin':'dreamer',alignment:i?'evil' as const:'good' as const}))},source:'twin'},
 {name:'text',payload:{messageKo:'전달할 정보',labelKo:'확인',valueKo:'결과'},source:'tb'},
];
const evidence:Array<{name:string;source:string;custom:string;original:string}>=[];
afterEach(cleanup);
afterAll(()=>{const path=(Reflect.get(process,'env') as Record<string,string|undefined>).ISSUE220_T9_REVEAL_EVIDENCE;if(path){mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(evidence,null,2));}});
it.each(cases)('T9-6: $name uses a closable payload-only public surface',({name,payload,source})=>{
 const close=vi.fn();const root=document.createElement('main');root.id='root';root.textContent='SECRET STORYTELLER DATA';document.body.append(root);
 render(<CustomReveal payload={payload} onClose={close}/>);
 const dialog=screen.getByRole('dialog',{name:'플레이어 정보'});
 expect(dialog.textContent).not.toContain('SECRET');expect(root.style.visibility).toBe('hidden');
 expect(dialog.querySelectorAll('button')).toHaveLength(1);
 expect(screen.getByRole('button',{name:'확인했으면 눈을 감으세요'})).toBe(document.activeElement);
 expect(Array.from(dialog.querySelectorAll('img')).every(img=>!!img.getAttribute('src'))).toBe(true);
 const custom=dialog.parentElement!.outerHTML;fireEvent.click(screen.getByRole('button',{name:'확인했으면 눈을 감으세요'}));expect(close).toHaveBeenCalledOnce();cleanup();expect(root.style.visibility).toBe('');root.remove();
 const reveal={sourceEventId:'test',sequence:1,payload} as never;
 if(source==='tb')render(<TroubleBrewingRevealScreen payload={payload as never} onClose={()=>{}}/>);
 else if(source==='madness')render(<CerenovusMadnessReveal reveal={reveal} onConfirm={()=>{}}/>);
 else if(source==='change')render(<CharacterChangeReveal reveal={reveal} total={1} onConfirm={()=>{}}/>);
 else if(source==='twin')render(<EvilTwinReveal reveal={reveal} onConfirm={()=>{}}/>);
 else render(<SectsAndVioletsReveal dialogLabel="원본 정보" className="snvProductionInformationReveal" closeLabel="확인했으면 눈을 감으세요" onClose={()=>{}}><SnvInformationRevealContent payload={payload as never} label={id=>characterPresentation(id)?.label??id} icon={id=><img src={characterPresentation(id)?.image} alt=""/>}/></SectsAndVioletsReveal>);
 const original=screen.getByRole('dialog');expect(dialog.textContent).toBe(original.textContent);
 evidence.push({name,source,custom,original:original.parentElement!.outerHTML});
});
