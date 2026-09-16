import {expect,it} from 'vitest';
import {writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {actionCases,actionFixture,confirmFixture} from './custom/issue220T13Support';
it('T13 browser fixtures are actual confirmed Core prefixes, not hand-written runtime state',async()=>{
 const games:Record<string,unknown>={};
 for(const [name,id] of [['start','R02'],['twin','R14'],['fortuneTeller','R05'],['twinCompleted','R27']]){
  const f=await actionFixture(actionCases.find(c=>c[0]===id)!);if(name==='twinCompleted')await confirmFixture(f);
  games[name]=f.session.snapshot.canonical;expect(f.session.replay).toBeDefined();
 }
 for(const id of ['R04','R09','R10','R11','R12','R13','R19','R25','R26']){const f=await actionFixture(actionCases.find(c=>c[0]===id)!);games[id]=f.session.snapshot.canonical;}
 const path=(Reflect.get(process,'env') as Record<string,string|undefined>).ISSUE220_T13_FIXTURES;if(path){mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(games));}
});
