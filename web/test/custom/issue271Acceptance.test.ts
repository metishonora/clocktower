import {it,expect,vi,afterEach} from 'vitest';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {create271,first271,next271,act271,everyonePool} from './issue271Support';
import {exportGameFileJson,parseGameFileJson} from '../../src/custom/storage/gameFile';
import type {FirstNightController} from '../../src/custom/grimoire/firstNightController';
afterEach(()=>vi.useRealTimers());
async function snapshot(name:string,c:FirstNightController){
 const json=exportGameFileJson(c.getSnapshot().file),file=parseGameFileJson(json);
 expect(file.game.script.definition.characterIds).toEqual(everyonePool);
 const path=`../fixtures/acceptance/issue271/${name}.game.json`;
 if(process.env.WRITE_ISSUE271==='1'){mkdirSync('../fixtures/acceptance/issue271',{recursive:true});writeFileSync(path,json+'\n');}
 const saved=parseGameFileJson(readFileSync(path,'utf8'));
 const {controller:loaded}=await create271(saved);
 expect(loaded.getSnapshot().replay).toEqual(c.getSnapshot().replay);loaded.dispose();
}
it('Everyone Can Play 24-role pool uses a legal roster and round-trips every acceptance checkpoint',async()=>{
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-08T00:00:00Z'));
 const {controller:c}=await create271();
 await snapshot('advocate',c);await act271(c,{playerIds:['p3']});await snapshot('grandmother',c);
 await act271(c,{playerIds:['p5']});await act271(c,null);
 for(let i=0;i<3;i++)await c.confirmDay({kind:'advance'});
 await c.confirmDay({kind:'nominate',nominatorId:'p5',nomineeId:'p3',spyAsTownsfolk:false});await c.confirmDay({kind:'vote',voterIds:['p1','p2','p3','p4','p5','p6']});await c.confirmDay({kind:'closeNominations'});await snapshot('execution',c);c.dispose();
 const {controller:n}=await create271();await first271(n);await next271(n);await snapshot('gambler',n);
 await act271(n,{playerIds:['p2'],characterIds:['gambler']});await act271(n,{playerIds:['p3']});await act271(n,{playerIds:['p7']});await snapshot('grandmother-chain',n);
 await act271(n,{playerIds:['p9']});await snapshot('assassin',n);await act271(n,null);await act271(n,null);await n.confirmDay({kind:'advance'});await snapshot('moonchild',n);
 const consequence=n.getSnapshot().replay.day!.consequences[0];await n.confirmDay({kind:'resolveConsequence',consequenceId:consequence.id,playerId:'p3'});
 for(let i=0;i<2;i++)await n.confirmDay({kind:'advance'});await n.confirmDay({kind:'closeNominations'});await n.confirmDayExecution();await n.confirmDay({kind:'beginNight'});
 await act271(n,{playerIds:['p2'],characterIds:['gambler']});await act271(n,{playerIds:['p7']});await act271(n,{playerIds:['p3']});await act271(n,{playerIds:['p7']});await act271(n,null);await snapshot('moonchild-night',n);n.dispose();
});

it('poisoned Grandmother checkpoint preserves a legal ECP roster and the separate delivery choices',async()=>{
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-08T00:00:00Z'));
 const {controller:c}=await create271(undefined,{roster:['grandmother','artist','slayer','mayor','fool','poisoner','imp']});
 await act271(c,{playerIds:['p1']});await snapshot('poisoned-grandmother',c);c.dispose();
});
