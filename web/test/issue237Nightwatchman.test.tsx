import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {CustomNightTask} from '../src/grimoire-custom/CustomNightTask';
import {CustomReveal} from '../src/grimoire-custom/CustomReveal';
import {CustomGrimoireBoard} from '../src/grimoire-custom/CustomGrimoireBoard';
import {FirstNightController} from '../src/custom/grimoire/firstNightController';
import type {CustomScriptDefinition} from '../src/custom/core/types';
import {isRevealPayload} from '../src/custom/core/revealPayload';
import {realWasmCore} from './custom/realCustomWasmHarness';
import {createSession} from './custom/snvSupport';
import {CustomCanonicalSession} from '../src/custom/session';
import {IndexedDbCustomWebSessionStorageDriver} from '../src/custom/storage/sessionStorage';
import type {GrimoireSetupDraft,GrimoirePresentationState} from '../src/custom/grimoire/setupController';
import {IDBFactory} from 'fake-indexeddb';

afterEach(cleanup);
it('Nightwatchman notification shows its icon and only the delivered identity card',()=>{
 render(<CustomReveal payload={{kind:'nightwatchmanInformation',recipientPlayer:{playerId:'p1',seat:1,name:'P1'},nightwatchmanPlayer:{playerId:'p2',seat:2,name:'P2'}}} onClose={()=>{}}/>);
 const dialog=screen.getByRole('dialog',{name:'플레이어 정보'});
 expect(within(dialog).getByAltText('야경꾼')).toBeDefined();
 expect(within(dialog).getByText('2번')).toBeDefined();
 expect(within(dialog).getByText('P2')).toBeDefined();
 expect(within(dialog).queryByText('P1')).toBeNull();
 expect(dialog.textContent).toContain('이 사람이 야경꾼입니다.');
});
const script:CustomScriptDefinition={id:'carousel-ui237',name:'Carousel',
 characterIds:['nightwatchman','zealot','artist','savant','scarletWoman','imp','vortox','soldier','mayor','virgin'],
 firstNightOrder:[{kind:'system',actionId:'dusk'},{kind:'system',actionId:'minionInfo'},{kind:'system',actionId:'demonInfo'},{kind:'character',characterId:'nightwatchman',actionId:'choosePlayer'},{kind:'system',actionId:'dawn'}],
 otherNightOrder:[{kind:'system',actionId:'dusk'},{kind:'character',characterId:'imp',actionId:'attackPlayer'},{kind:'character',characterId:'vortox',actionId:'attackPlayer'},{kind:'character',characterId:'nightwatchman',actionId:'choosePlayer'},{kind:'system',actionId:'dawn'}],
};
async function setup(demon='imp') {
 const roster=['nightwatchman','zealot','artist','savant','scarletWoman',demon];
 const {session:seed}=await createSession(roster,script);
 const storage=new IndexedDbCustomWebSessionStorageDriver<GrimoireSetupDraft,GrimoirePresentationState>(script.id,new IDBFactory());
 const loaded=await CustomCanonicalSession.fromFile<GrimoireSetupDraft,GrimoirePresentationState>(seed.snapshot.canonical,{core:realWasmCore(),storage,
  setupDraft:{playerCount:roster.length,selectedIds:roster,players:roster.map((actualCharacter,i)=>({id:`p${i+1}`,seat:i+1,name:`P${i+1}`,actualCharacter}))},presentation:{activeTab:'play'}});
 if(!loaded.ok)throw new Error(loaded.error.messageKo);
 const session=loaded.value;
 return {controller:new FirstNightController(session,realWasmCore()),session,storage};
}
it('defers immediately with no confirmation or spent token',async()=>{
 const {controller}=await setup();
 render(<CustomNightTask controller={controller}/>);
 fireEvent.click(screen.getByRole('button',{name:'오늘 사용하지 않음'}));
 await vi.waitFor(()=>expect(controller.step?.actionRef?.actionId).toBe('dawn'));
 expect(controller.getSnapshot().error).toBeUndefined();
 expect(controller.getSnapshot().proposal).toBeUndefined();
 expect(controller.getSnapshot().handoff).toBeUndefined();
 expect(controller.getSnapshot().replay.ruleState.abilityUses??[]).toEqual([]);
 controller.dispose();
});
it('saves before recipient notification, restores the checkpoint and spends one use',async()=>{
 const {controller,storage}=await setup();
 controller.updateInput({playerIds:['p2']});
 await controller.prepareCurrent();
 await vi.waitFor(()=>expect(controller.getSnapshot().saveStatus).toBe('saved'));
 expect(controller.getSnapshot().error).toBeUndefined();
 const p=controller.getSnapshot().handoff?.notifications[0];
 expect(p).toEqual({kind:'nightwatchmanInformation',recipientPlayer:{playerId:'p2',seat:2,name:'P2'},nightwatchmanPlayer:{playerId:'p1',seat:1,name:'P1'}});
 expect(controller.getSnapshot().public).toBe(false);
 expect(isRevealPayload({...p,actualCharacter:'imp'})).toBe(false);
 controller.dispose();
 const loaded=await CustomCanonicalSession.load({core:realWasmCore(),storage});
 if(loaded.status!=='loaded')throw new Error(`Unexpected restore status: ${loaded.status}`);
 const restored=new FirstNightController(loaded.session,realWasmCore());
 expect(restored.getSnapshot().handoff?.notifications[0]).toEqual(p);
 render(<CustomGrimoireBoard controller={restored} file={restored.getSnapshot().file} replay={restored.getSnapshot().replay} onProgress={()=>{}} onSelectionDone={()=>{}}/>);
 expect(screen.getByRole('dialog',{name:'야경꾼 통지'})).toBeDefined();
 expect(screen.getByText('2번 P2')).toBeDefined();
 restored.showNotification();
 expect(restored.getSnapshot().public).toBe(true);
 restored.conceal();
 expect(restored.getSnapshot().handoff).toBeUndefined();
 restored.dispose();
});
it('only offers false Nightwatchman identities under Vortox',async()=>{
 const {controller}=await setup('vortox');
 controller.updateInput({playerIds:['p2']});
 render(<CustomNightTask controller={controller}/>);
 const group=within(screen.getByRole('group',{name:'야경꾼으로 알려줄 사람'}));
 expect(group.queryByRole('button',{name:'P1'})).toBeNull();
 fireEvent.click(group.getByRole('button',{name:'P3'}));
 await controller.prepareCurrent();
 expect(controller.getSnapshot().error).toBeUndefined();
 const reveal=controller.getSnapshot().handoff?.notifications[0];
 expect(reveal&&'kind'in reveal&&reveal.kind==='nightwatchmanInformation'&&reveal.nightwatchmanPlayer.playerId).not.toBe('p1');
 controller.dispose();
});
it('does not disclose a notification until its failed save is retried',async()=>{
 const {controller,storage}=await setup();
 const write=vi.spyOn(storage,'saveSession').mockRejectedValueOnce(new Error('quota'));
 controller.updateInput({playerIds:['p2']});
 await controller.prepareCurrent();
 await vi.waitFor(()=>expect(controller.getSnapshot().saveStatus).toBe('failed'));
 controller.showNotification();
 expect(controller.getSnapshot().public).toBe(false);
 expect(controller.getSnapshot().handoff).toBeUndefined();
 write.mockRestore();
 controller.retrySave();
 await vi.waitFor(()=>expect(controller.getSnapshot().handoff?.stage).toBe('notification'));
 expect(controller.getSnapshot().saveStatus).toBe('saved');
 controller.showNotification();
 expect(controller.getSnapshot().public).toBe(true);
 controller.dispose();
});
