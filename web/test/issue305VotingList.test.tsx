import {useState} from 'react';
import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {VotingList,type VotingListPlayer} from '../src/shared-ui/VotingList';
import {CustomDayBoard} from '../src/grimoire-custom/CustomDayBoard';
import {daytime,toNominations} from './custom/issue223Support';

const roster:VotingListPlayer[]=Array.from({length:7},(_,i)=>({id:`p${i+1}`,seat:i+1,name:`Player ${i+1}`,alive:true,ghostVoteUsed:false,eligible:true}));
const row=(seat:number)=>screen.getByRole('button',{name:new RegExp(`^${seat}번 좌석,`)}) as HTMLButtonElement;
const click=(name:string)=>fireEvent.click(screen.getByRole('button',{name}));

it('orders after the nominee, skips spent and forced voters, and keeps corrections behind the cursor',()=>{
 const players=roster.map(p=>p.id==='p3'?{...p,alive:false,ghostVoteUsed:true,eligible:false}:p.id==='p4'?{...p,forced:true}:p.id==='p5'?{...p,alive:false}:p);
 const confirm=vi.fn();
 function Ballot(){
  const [voterIds,setVoterIds]=useState(['p4']);const [cursor,setCursor]=useState(0);
  return <VotingList players={players} nominatorId="p1" nomineeId="p2" voterIds={voterIds} cursor={cursor} count={voterIds.length} targetVotes={4}
   onVote={(id,raised,next)=>{setVoterIds(ids=>raised?[...new Set([...ids,id])]:ids.filter(v=>v!==id));setCursor(next);}}
   onReset={()=>{setVoterIds(['p4']);setCursor(0);}} onCancel={()=>{}} onConfirm={()=>confirm({voterIds,cursor})}/>;
 }
 render(<Ballot/>);
 expect(within(screen.getByRole('list',{name:'투표자 선택'})).getAllByRole('button').map(b=>b.getAttribute('aria-label')?.split('번')[0])).toEqual(['3','4','5','6','7','1','2']);
 expect(row(3).disabled).toBe(true);expect(row(4).disabled).toBe(true);
 expect(row(5).getAttribute('aria-current')).toBe('step');
 click('투표함');expect(row(5).getAttribute('aria-pressed')).toBe('true');expect(screen.getByText('유령표 사용 예정: 5번 Player 5')).toBeTruthy();
 click('안함');expect(row(7).getAttribute('aria-current')).toBe('step');
 fireEvent.click(row(5));expect(row(7).getAttribute('aria-current')).toBe('step');
 click('1표로 투표 확정');expect(confirm).toHaveBeenCalledWith({voterIds:['p4'],cursor:4});
 for(let i=0;i<3;i++)click('투표함');
 expect((screen.getByRole('button',{name:'투표함'}) as HTMLButtonElement).disabled).toBe(true);
 expect((screen.getByRole('button',{name:'안함'}) as HTMLButtonElement).disabled).toBe(true);
 click('투표 초기화 X');expect(row(5).getAttribute('aria-current')).toBe('step');expect(row(4).getAttribute('aria-pressed')).toBe('true');
});

it('locks all edits while saving and shows a committed ghost vote in the result',()=>{
 const onVote=vi.fn();const props={players:roster.map(p=>p.id==='p3'?{...p,alive:false,ghostVoteUsed:true,eligible:false}:p),nominatorId:'p1',nomineeId:'p2',voterIds:['p3'],cursor:1,count:1,targetVotes:4,onVote,onReset:vi.fn(),onCancel:vi.fn(),onConfirm:vi.fn(),onComplete:vi.fn()};
 const view=render(<VotingList {...props} busy/>);
 fireEvent.click(row(4));click('투표함');expect(onVote).not.toHaveBeenCalled();
 expect(screen.getAllByRole('button').every(b=>(b as HTMLButtonElement).disabled)).toBe(true);
 view.rerender(<VotingList {...props} complete resultSummary="처형 후보 없음"/>);
 expect(row(3).getAttribute('aria-pressed')).toBe('true');expect(row(3).textContent).toContain('유령표 사용');
 expect(row(3).classList.contains('isUnavailable')).toBe(false);
 expect(screen.queryByRole('button',{name:'투표함'})).toBeNull();click('투표 완료 →');expect(props.onComplete).toHaveBeenCalledOnce();
});

it('restores the same custom ballot and cursor after undoing an early confirmation',async()=>{
 const {app,play}=await daytime();await toNominations(play);
 play.beginDayHandoff();play.selectDayPlayer('p1');play.selectDayPlayer('p2');await play.confirmDayHandoff();
 render(<CustomDayBoard controller={play}/>);
 expect(row(3).getAttribute('aria-current')).toBe('step');
 click('투표함');click('안함');expect(row(5).getAttribute('aria-current')).toBe('step');
 await act(()=>play.confirmDayHandoff());
 expect(screen.getByRole('heading',{name:'투표 결과'})).toBeTruthy();
 await act(()=>play.undo());await waitFor(()=>expect(play.getSnapshot().saveStatus).toBe('saved'));
 expect(play.getSnapshot().replay.day?.stage).toBe('voting');
 expect(row(3).getAttribute('aria-pressed')).toBe('true');expect(row(5).getAttribute('aria-current')).toBe('step');
 click('투표함');expect(row(6).getAttribute('aria-current')).toBe('step');
 expect(play.getSnapshot().dayHandoff?.voterIds).toEqual(['p3','p5']);
 app.dispose();
});
