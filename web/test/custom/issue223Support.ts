import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, vi } from 'vitest';
import { CustomGrimoireApplicationController } from '../../src/custom/grimoire/applicationController.js';
import { parseGameFileJson } from '../../src/custom/storage/gameFile.js';
import type { DayInput } from '../../src/custom/core/dayTypes.js';
import type { FirstNightController } from '../../src/custom/grimoire/firstNightController.js';
import { realWasmCore } from './realCustomWasmHarness.js';
export function daytimeFile() {return parseGameFileJson(readFileSync(resolve(process.cwd(),'../fixtures/acceptance/custom-first-night/compatibility/day.game.json'),'utf8'));}
export async function daytime() {
  const app=new CustomGrimoireApplicationController(realWasmCore(),vi.fn());
  await app.resumeImported({file:daytimeFile()});
  expect(app.play).toBeDefined();expect(app.play!.getSnapshot().replay.day?.stage).toBe('announcement');
  return {app,play:app.play!};
}
export async function dayInput(play:FirstNightController,input:DayInput) {
  await play.confirmDay(input);expect(play.getSnapshot().error).toBeUndefined();
  await vi.waitFor(()=>expect(play.getSnapshot().saveStatus).toBe('saved'));
}
export async function toNominations(play:FirstNightController) {for(let i=0;i<3;i++)await dayInput(play,{kind:'advance'});}
