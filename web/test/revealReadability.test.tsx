import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CustomReveal } from '../src/grimoire-custom/CustomReveal';
import { CustomNotificationPrompt } from '../src/grimoire-custom/CustomNotificationPrompt';
import type { RevealPayload } from '../src/custom/core/types';
beforeEach(()=>{const values=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)});});
afterEach(()=>{cleanup();document.getElementById('root')?.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
const person={playerId:'p7',seat:7,name:'유진'};

it('asks to wake only the evil twin before the first reveal, regardless of payload order',()=>{
 const onReveal=vi.fn();
 render(<CustomNotificationPrompt payload={{kind:'evilTwinPair',players:[{...person,characterId:'dreamer',alignment:'good'},{playerId:'p4',seat:4,name:'도윤',characterId:'evilTwin',alignment:'evil'}]}} players={[]} sequence={1} total={1} onReveal={onReveal}/>);
 expect(screen.getByText('악한 쌍둥이를 깨웁니다.')).toBeTruthy();
 expect(screen.getByText('[4번 도윤]')).toBeTruthy();expect(screen.queryByText(/유진/)).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'공개'}));expect(onReveal).toHaveBeenCalledOnce();
});

it('keeps the Storyteller hidden through both twin reveals and closes only after shared confirmation',()=>{
 const root=document.createElement('div');root.id='root';root.textContent='STORYTELLER SECRET';document.body.append(root);
 const onClose=vi.fn();
 render(<CustomReveal payload={{kind:'evilTwinPair',players:[{playerId:'p4',seat:4,name:'도윤',characterId:'evilTwin',alignment:'evil'},{...person,characterId:'dreamer',alignment:'good'}]}} onClose={onClose}/>);
 expect(root.style.visibility).toBe('hidden');expect(root.inert).toBe(true);
 expect(screen.getByText('쌍둥이의 직업을 흉내내세요.')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'확인했으면 다음 단계로'}));
 expect(screen.getByText('선한 쌍둥이')).toBeTruthy();expect(screen.getByText('7번')).toBeTruthy();expect(screen.getByText('유진')).toBeTruthy();expect(screen.getByText('를 깨웁니다.')).toBeTruthy();
 expect(screen.queryByText('도윤')).toBeNull();expect(onClose).not.toHaveBeenCalled();
 expect(root.style.visibility).toBe('hidden');
 fireEvent.click(screen.getByRole('button',{name:'두 쌍둥이에게 공개'}));
 expect(screen.getByText('여러분은 쌍둥이입니다.')).toBeTruthy();
 expect(screen.queryByText('쌍둥이의 직업을 흉내내세요.')).toBeNull();expect(onClose).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'확인했으면 눈을 감으세요'}));expect(onClose).toHaveBeenCalledTimes(1);
 cleanup();expect(root.style.visibility).toBe('');expect(root.inert).toBe(false);
});
it('keeps focus inside the reveal controls, saves size, and does not let Escape skip twin stages',()=>{
 const onClose=vi.fn();
 const payload:RevealPayload={kind:'evilTwinPair',players:[{playerId:'p4',seat:4,name:'도윤',characterId:'evilTwin',alignment:'evil'},{...person,characterId:'dreamer',alignment:'good'}]};
 const view=render(<CustomReveal payload={payload} onClose={onClose}/>);
 const smaller=screen.getByRole('button',{name:'글씨 작게'}),bigger=screen.getByRole('button',{name:'글씨 크게'});
 fireEvent.keyDown(document,{key:'Tab'});expect(document.activeElement).toBe(smaller);
 smaller.focus();fireEvent.keyDown(document,{key:'Tab',shiftKey:true});expect(document.activeElement).toBe(screen.getByRole('button',{name:'확인했으면 다음 단계로'}));
 for(let i=0;i<4;i++)fireEvent.click(bigger);
 expect((bigger as HTMLButtonElement).disabled).toBe(true);
 fireEvent.keyDown(document,{key:'Escape'});expect(onClose).not.toHaveBeenCalled();expect(screen.getByText('선한 쌍둥이')).toBeTruthy();expect(screen.getByText('유진')).toBeTruthy();
 view.unmount();render(<CustomReveal payload={{kind:'numericInformation',characterId:'clockmaker',value:0}} onClose={onClose}/>);
 expect(screen.getByText('글씨 크기 140%')).toBeTruthy();expect(screen.getByText('0')).toBeTruthy();
});
it('shows only the delivered Dreamer target and character choices',()=>{
 render(<CustomReveal payload={{kind:'dreamerInformation',targetPlayer:person,characterIds:['clockmaker','witch']}} onClose={()=>{}}/>);
 expect(screen.getByText('7번')).toBeTruthy();expect(screen.getByText('유진')).toBeTruthy();
 expect(screen.getByText('시계공')).toBeTruthy();expect(screen.getByText('마녀')).toBeTruthy();
 expect(screen.getByText('또는')).toBeTruthy();
});
it('shows minions first and retains the demon-only Marionette identity',()=>{
 const view=render(<CustomReveal payload={{kind:'minionInformation',minionPlayers:[person],demonPlayers:[{seat:2,name:'하린'}]}} onClose={()=>{}}/>);
 expect(screen.getByText('유진')).toBeTruthy();expect(screen.getByText('하린')).toBeTruthy();
 expect(document.body.textContent?.indexOf('유진')).toBeLessThan(document.body.textContent?.indexOf('악마는')??0);
 view.unmount();render(<CustomReveal payload={{kind:'demonInformation',minionPlayers:[],marionettePlayers:[person],bluffCharacterIds:['artist','sage','oracle']}} onClose={()=>{}}/>);
 expect(screen.queryByText('당신의 하수인은 없습니다.')).toBeNull();expect(screen.getByText('꼭두각시')).toBeTruthy();expect(screen.getByText('유진')).toBeTruthy();
 expect(screen.getByText('이 직업들은 이번 게임에 없습니다.')).toBeTruthy();
});
it('renders the requested Cerenovus emphasis and preserves current alignment on character change',()=>{
 const view=render(<CustomReveal payload={{kind:'madnessAssignment',playerId:'p7',characterId:'clockmaker'}} onClose={()=>{}}/>);
 expect(screen.getByAltText('세레노버스')).toBeTruthy();
 expect(document.querySelector('.customRevealEvilAccent')?.textContent).toBe('세레노버스');
 expect(document.querySelector('.customRevealGoldAccent')?.textContent).toBe('시계공');
 view.unmount();render(<CustomReveal payload={{kind:'characterChange',playerId:'p7',characterId:'witch',alignment:'good'}} onClose={()=>{}}/>);
 expect(screen.getByText('선')).toBeTruthy();expect(screen.getByText('마녀')).toBeTruthy();expect(screen.queryByText('마귀할멈')).toBeNull();
});
it('handles both boolean answers and uses the readable layout for TB numbers',()=>{
 const view=render(<CustomReveal payload={{kind:'booleanInformation',characterId:'flowergirl',value:false}} onClose={()=>{}}/>);
 expect(screen.getByText('투표하지 않음')).toBeTruthy();view.unmount();
 const yes=render(<CustomReveal payload={{kind:'booleanInformation',characterId:'townCrier',value:true}} onClose={()=>{}}/>);
 expect(screen.getByText('지목함')).toBeTruthy();yes.unmount();
 render(<CustomReveal payload={{kind:'numericInformation',characterId:'chef',value:2}} onClose={()=>{}}/>);
 expect(document.querySelector('.customReadableReveal')).not.toBeNull();expect(document.querySelector('.customReadableNumber')?.textContent).toBe('2쌍');
});
it('renders Barber instructions and remains usable when preferences cannot be saved',()=>{
 vi.spyOn(localStorage,'setItem').mockImplementation(()=>{throw Error('storage unavailable');});
 render(<CustomReveal payload={{kind:'barberInstruction'}} onClose={()=>{}}/>);
 for(const text of ['이발사가 사망했습니다.','직업을 교환할 두 명을 고르십시오.','고르지 않으려면, 고개를 저으십시오.'])expect(screen.getByText(text)).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'글씨 크게'}));expect(screen.getByText('글씨 크기 110%')).toBeTruthy();
});
