import {expect,vi} from 'vitest';
import type {FirstNightController} from '../../src/custom/grimoire/firstNightController';
import type {CustomScriptDefinition} from '../../src/custom/core/types';
import {nightFixture} from './issue222Support';
export function scheduledOrder(d:CustomScriptDefinition) {
 d.nightOrderVersion=2;
 let index=0;d.otherNightOrder.forEach((a,i)=>{if(a.kind==='character'&&(a.actionId==='attackPlayer'||a.characterId==='pitHag'))index=i;});
 d.otherNightOrder.splice(index+1,0,{kind:'system',actionId:'resolveNightDeaths'});
}
export async function finishCheckpoint(c:FirstNightController) {
 for(let i=0;i<8&&c.getSnapshot().handoff;i++) {
  await vi.waitFor(()=>expect(c.getSnapshot().saveStatus).toBe('saved'));
  if(c.getSnapshot().handoff?.stage==='result')c.finishHandoff();
  else if(c.getSnapshot().handoff?.stage==='notification'){c.showNotification();c.conceal();}
  else break;
 }
}
export async function select(c:FirstNightController,ids:string[],characters?:string[]) {
 await finishCheckpoint(c);await vi.waitFor(()=>expect(c.getSnapshot().saveStatus).toBe('saved'));
 c.beginSelection();ids.forEach(c.togglePlayer);if(characters)c.updateInput({characterIds:characters});
 expect(c.selectionReady).toBe(true);await c.acceptSelection();expect(c.getSnapshot().error).toBeUndefined();
}
export async function scheduledDeathsFixture() {
 const fixture=await nightFixture(['soldier','monk','ravenkeeper','virgin','slayer','pitHag','imp'],{},['fangGu'],scheduledOrder);
 const c=fixture.controller;
 await select(c,['p1']);await select(c,['p7'],['fangGu']);await finishCheckpoint(c);
 expect(c.step?.actionRef?.actionId).toBe('attackPlayer');await select(c,['p4']);await finishCheckpoint(c);
 expect(c.step?.actionRef).toEqual({kind:'system',actionId:'resolveNightDeaths'});
 return fixture;
}
