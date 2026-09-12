import {it,expect} from 'vitest';
import {writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {preparedRole,setupCases} from './custom/issue220T10TestSupport';
import {scenario,newScenario,confirmAction,roster} from './custom/issue220ScenarioOrderSupport';
it('generates validated start positions for production browser actions',async()=>{
 const fixtures:Record<string,unknown>={};
 for(const [name,index,condition] of [['washerwoman',0,'poisoned'],['librarian',1,'duplicate'],['investigator',2,'healthy']] as const){
  const {app}=await preparedRole(setupCases[index],condition);fixtures[name]=app.play!.getSnapshot().file;app.dispose();
 }
 for(const [name,action] of [['chef','learnEvilPairs'],['fortuneTeller','checkDemon'],['spy','inspectGrimoire']] as const){
  const d=structuredClone(scenario),row=d.firstNightOrder.find(r=>r.actionId===action)!;
  d.firstNightOrder=d.firstNightOrder.filter(r=>r!==row);d.firstNightOrder.splice(3,0,row);
  if(name==='spy'){const poison=d.firstNightOrder.find(r=>r.actionId==='choosePoisonTarget')!;d.firstNightOrder=d.firstNightOrder.filter(r=>r!==poison);d.firstNightOrder.splice(3,0,poison);}
  const {session}=await newScenario(d);await confirmAction(session,'minionInfo',null);await confirmAction(session,'demonInfo',{characterIds:['ravenkeeper','undertaker','juggler']});
  if(name==='spy')await confirmAction(session,'choosePoisonTarget',{playerIds:['p1']});
  fixtures[name]=session.snapshot.canonical;
 }
 for(const [name,action] of [['clockmaker','learnSteps'],['dreamer','learnCharacters'],['seamstress','compareAlignments'],['mathematician','learnCount']] as const){
  const d=structuredClone(scenario);if(!d.characterIds.includes(name))d.characterIds.push(name);
  d.firstNightOrder=d.firstNightOrder.filter(r=>r.actionId!==action);d.firstNightOrder.splice(3,0,{kind:'character',characterId:name,actionId:action});
  const {session}=await newScenario(d,roster.map(id=>id==='monk'?name:id));await confirmAction(session,'minionInfo',null);await confirmAction(session,'demonInfo',{characterIds:['ravenkeeper','undertaker','juggler']});
  fixtures[name]=session.snapshot.canonical;
 }
 expect(Object.keys(fixtures)).toHaveLength(10);
 const output=(Reflect.get(process,'env') as Record<string,string|undefined>).ISSUE220_T10_PRODUCTION_FIXTURES;
 if(output){mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(fixtures));}
});
