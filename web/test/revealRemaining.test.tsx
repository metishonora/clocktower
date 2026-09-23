import {afterAll,afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {CustomReveal} from '../src/grimoire-custom/CustomReveal';
import type {RevealPayload,RevealPlayer} from '../src/custom/core/types';
const people:[RevealPlayer,RevealPlayer]=[{playerId:'p1',seat:1,name:'민지'},{playerId:'p3',seat:3,name:'서윤'}];
const recipient={playerId:'p7',seat:7,name:'비공개 수신자'};
const cases:Array<{name:string;payload:RevealPayload;copy:string;people?:string[];role?:string;icon?:string}>=[
 ...(['washerwoman','librarian','investigator'] as const).map(characterId=>({name:characterId,payload:{kind:'setupInformation' as const,characterId,candidatePlayers:people,zeroOutsiders:false as const,revealedCharacterId:'monk'},copy:'둘 중 한 명은',people:['민지','서윤'],role:'수도사',icon:characterId})),
 {name:'librarian-zero',payload:{kind:'setupInformation',characterId:'librarian',zeroOutsiders:true,candidatePlayers:[]},copy:'이 게임에는 외부인이 없습니다.',icon:'librarian'},
 {name:'chef-zero',payload:{kind:'numericInformation',characterId:'chef',value:0},copy:'0쌍',icon:'chef'},
 {name:'empath-zero',payload:{kind:'numericInformation',characterId:'empath',value:0},copy:'0명',icon:'empath'},
 ...[false,true].map(hasDemon=>({name:`fortuneTeller-${hasDemon}`,payload:{kind:'fortuneTellerInformation' as const,hasDemon,targetPlayers:people},copy:hasDemon?'있습니다.':'없습니다.',people:['민지','서윤'],icon:'fortuneTeller'})),
 ...(['undertaker','ravenkeeper'] as const).map(characterId=>({name:characterId,payload:{kind:'characterInformation' as const,characterId,targetPlayer:people[0],revealedCharacterId:'monk'},copy:'이 사람의 직업은',people:['민지'],role:'수도사',icon:characterId})),
 ...[0,7].map(value=>({name:`chambermaid-${value}`,payload:{kind:'chambermaidInformation' as const,targetPlayers:people,value},copy:`이 중 ${value}명이 깨어났습니다.`,people:['민지','서윤'],icon:'chambermaid'})),
 {name:'nightwatchman',payload:{kind:'nightwatchmanInformation',recipientPlayer:recipient,nightwatchmanPlayer:people[0]},copy:'이 사람이 야경꾼입니다.',people:['민지'],icon:'nightwatchman'},
 {name:'balloonist',payload:{kind:'learnedPlayer',sourceCharacterId:'balloonist',player:people[1]},copy:'서윤',people:['서윤'],icon:'balloonist'},
 {name:'pixie',payload:{kind:'learnedCharacter',sourceCharacterId:'pixie',characterId:'monk'},copy:'이 직업이 게임에 있습니다.',role:'수도사',icon:'pixie'},
 ...[false,true].map(recipientIsSource=>({name:`boffin-${recipientIsSource}`,payload:{kind:'grantedAbilityInformation' as const,recipientPlayer:recipient,sourceCharacterId:'boffin' as const,characterId:'monk',recipientIsSource},copy:recipientIsSource?'악마에게 부여한 능력':'과학자가 준 능력',role:'수도사',icon:'boffin'})),
 {name:'preacher',payload:{kind:'preacherInformation',recipientPlayer:recipient},copy:'전도사가 당신을 선택했습니다.',icon:'preacher'},
 {name:'demon-marionette',payload:{kind:'demonInformation',minionPlayers:[people[0]],marionettePlayers:[people[1]],bluffCharacterIds:['monk','librarian','saint']},copy:'이 직업들은 이번 게임에 없습니다.',people:['민지','서윤']},
];
const evidence:Array<{name:string;html:string}>=[];
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
afterAll(()=>{const path=(Reflect.get(process,'env') as Record<string,string|undefined>).REVEAL_252_EVIDENCE;if(path){mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(evidence));}});
it.each(cases)('$name exposes only the delivered information in the approved readable layout',({name,payload,copy,people:expectedPeople=[],role,icon})=>{
 vi.stubGlobal('localStorage',{getItem:()=>null,setItem:()=>{}});
 const onClose=vi.fn();render(<CustomReveal payload={payload} onClose={onClose}/>);
 const dialog=screen.getByRole('dialog',{name:'플레이어 정보'}),panel=dialog.querySelector('.customReadablePanel')!;
 expect(panel.textContent).toContain(copy);
 expect(panel.textContent).not.toContain(recipient.name);
 expect(panel.textContent).not.toContain('집착');
 const cards=Array.from(panel.querySelectorAll('.customReadableCard'));
 for(const person of expectedPeople)expect(cards.some(card=>card.querySelector('span')?.textContent?.endsWith('번')&&card.querySelector('strong')?.textContent===person)).toBe(true);
 if(role)expect(cards.some(card=>card.querySelector('img')&&card.querySelector('strong')?.textContent===role)).toBe(true);
 const heading=panel.querySelector('.customRevealRoleIcon');
 if(icon)expect(heading?.getAttribute('src')?.toLowerCase()).toContain(icon.toLowerCase());else expect(heading).toBeNull();
 if(name==='balloonist'){expect(panel.querySelectorAll('p')).toHaveLength(0);expect(panel.querySelectorAll('img')).toHaveLength(1);}
 expect(panel.querySelector('button')).toBeNull();
 const close=screen.getByRole('button',{name:'확인했으면 눈을 감으세요'});expect(document.activeElement).toBe(close);
 for(let i=0;i<4;i++)fireEvent.click(screen.getByRole('button',{name:'글씨 크게'}));
 expect((screen.getByRole('button',{name:'글씨 크게'}) as HTMLButtonElement).disabled).toBe(true);
 evidence.push({name,html:dialog.parentElement!.outerHTML});
 fireEvent.keyDown(document,{key:'Escape'});expect(onClose).toHaveBeenCalledOnce();
});
it('retains the original Spy board and token detail interaction',()=>{
 render(<CustomReveal payload={{kind:'spyGrimoire',players:[{...people[0],characterId:'monk',alive:true,ghostVoteUsed:false,alignment:'good',reminderTokens:['protected']}]}} onClose={()=>{}}/>);
 expect(document.querySelector('.customReadableReveal')).toBeNull();
 expect(screen.queryByRole('button',{name:'글씨 크게'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:/1번 민지, 수도사, 생존/}));
 expect(document.querySelector('.playerTokenDetailDialog')).not.toBeNull();
});
