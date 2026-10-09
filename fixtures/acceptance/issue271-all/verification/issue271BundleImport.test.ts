import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {afterAll,beforeEach,it,expect} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
import {CustomGrimoireApplicationController} from '../../src/custom/grimoire/applicationController';
import {parseGameFileJson,exportGameFileJson} from '../../src/custom/storage/gameFile';
import {realWasmCore} from './realCustomWasmHarness';

const group=process.env.ISSUE271_GROUP!;
const directory=join(process.env.ISSUE271_BUNDLE??'/tmp/issue271-all',group);
const initialScreens:unknown[]=[];
afterAll(()=>{if(process.env.ISSUE271_START_REPORT)writeFileSync(process.env.ISSUE271_START_REPORT,JSON.stringify(initialScreens,null,2)+'\n');});
beforeEach(()=>Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:new IDBFactory()}));
for(const filename of readdirSync(directory).filter(name=>name.endsWith('.game.json'))){
 it(`imports and restores ${group}/${filename} through the production application`,async()=>{
  const file=parseGameFileJson(readFileSync(join(directory,filename),'utf8'));
  expect(parseGameFileJson(exportGameFileJson(file))).toEqual(file);
  const app=new CustomGrimoireApplicationController(realWasmCore(),()=>{});
  try{
   await app.resumeImported({file});
   expect(app.getSnapshot().error).toBeUndefined();
   expect(app.getSnapshot().screen).toBe('play');
   expect(app.play?.getSnapshot().file.game.events).toEqual(file.game.events);
   expect(app.play?.getSnapshot().replay.eventCount).toBe(file.game.events.length);
   const snapshot=app.play!.getSnapshot();
   initialScreens.push({file:`${group}/${filename}`,phase:snapshot.replay.phase,
    currentStep:snapshot.replay.currentStep?{character:snapshot.replay.currentStep.character,actionRef:snapshot.replay.currentStep.actionRef}:null,dayStage:snapshot.replay.day?.stage,
    handoff:snapshot.handoff?{stage:snapshot.handoff.stage,character:snapshot.handoff.step.character,
     actionRef:snapshot.handoff.step.actionRef,resultKind:snapshot.handoff.result?.kind}:null,
    dayHandoff:snapshot.dayHandoff,dayNotifications:snapshot.dayNotifications});
   const original=snapshot.replay;
   const restored=new CustomGrimoireApplicationController(realWasmCore(),()=>{});
   try{
    await restored.restoreGame(file.game.id);
    expect(restored.getSnapshot().error).toBeUndefined();
    expect(restored.getSnapshot().screen).toBe('play');
    expect(restored.play?.getSnapshot().replay).toEqual(original);
   }finally{restored.dispose();}
  }finally{app.dispose();}
 });
}
