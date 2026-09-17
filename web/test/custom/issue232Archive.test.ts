import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {it,expect} from 'vitest';
import {artifactRoot} from './issue232Artifacts.js';
import {parseGameFileJson} from '../../src/custom/storage/gameFile.js';
import {parseScenarioFileJson} from '../../src/custom/storage/scenarioFile.js';
import {replayOrThrow,realWasmCore} from './realCustomWasmHarness.js';
import {customFirstNightPlan,customOtherNightPlan} from '../../src/custom/core/wasmClient.js';

it('all shipped scenario and checkpoint files remain importable with explicit orders and real canonical replay',async()=>{
 realWasmCore();
 const manifest=JSON.parse(await readFile(resolve(artifactRoot,'manifest.json'),'utf8'));
 const listed:string[]=[];
 for(const game of manifest.games) {
  const scenario=parseScenarioFileJson(await readFile(resolve(artifactRoot,game.scenario),'utf8'));
  expect(scenario).toEqual({name:game.definition.name,characterIds:game.definition.characterIds,firstNightOrder:game.definition.firstNightOrder,otherNightOrder:game.definition.otherNightOrder,...(game.definition.nightOrderVersion?{nightOrderVersion:game.definition.nightOrderVersion}:{})});
  for(const plan of [await customFirstNightPlan(game.definition),await customOtherNightPlan(game.definition)])expect(plan).toMatchObject({ok:true,value:{source:'definition'}});
  for(const filename of game.checkpoints) {
   listed.push(filename);
   const file=parseGameFileJson(await readFile(resolve(artifactRoot,filename),'utf8'));
   const replay=await replayOrThrow(file);
   expect(replay.players).toHaveLength(15);
   expect(file.game.script.definition).toEqual(game.definition);
   if(filename.includes('-end-'))expect(replay.gameEnd).toBeTruthy();
   if(filename.includes('-start.'))expect(replay.phase).toBe('firstNight');
  }
 }
 expect(listed.sort()).toEqual((await readdir(artifactRoot)).filter(f=>f.endsWith('.game.json')).sort());
},120000);
