import { expect, vi } from 'vitest';
import type { CustomScriptDefinition } from '../../src/custom/core/types.js';
import { CustomGrimoireApplicationController } from '../../src/custom/grimoire/applicationController.js';
import { IndexedDbCustomWebSessionStorageDriver } from '../../src/custom/storage/sessionStorage.js';
import type { GrimoireSetupDraft, GrimoirePresentationState } from '../../src/custom/grimoire/setupController.js';
import { realWasmCore } from './realCustomWasmHarness.js';
export const definition: CustomScriptDefinition = { id:'issue220-acceptance', name:'첫날 밤 연결',
  characterIds:['chef','empath','clockmaker','poisoner','imp','soldier','mayor','virgin'],
  firstNightOrder:[{kind:'system',actionId:'dusk'},{kind:'system',actionId:'minionInfo'},{kind:'system',actionId:'demonInfo'},
    {kind:'character',characterId:'poisoner',actionId:'choosePoisonTarget'},{kind:'character',characterId:'chef',actionId:'learnEvilPairs'},
    {kind:'character',characterId:'empath',actionId:'learnEvilNeighbors'},{kind:'character',characterId:'clockmaker',actionId:'learnSteps'},{kind:'system',actionId:'dawn'}] };
export const roster=['chef','empath','clockmaker','poisoner','imp'];
export function driver() { return new IndexedDbCustomWebSessionStorageDriver<GrimoireSetupDraft, GrimoirePresentationState>(definition.id); }
export async function arranged(name='플레이어 1') {
  const activated=vi.fn(); const app=new CustomGrimoireApplicationController(realWasmCore(),activated);
  app.startSetup({definition}); const setup=app.setup!; setup.setPlayerCount(5); await vi.waitFor(()=>expect(setup.getSnapshot().distributionPending).toBe(false));
  for (const id of roster) { setup.toggleCharacter(id); await vi.waitFor(()=>expect(setup.getSnapshot().distributionPending).toBe(false)); }
  await vi.waitFor(()=>expect(setup.getSnapshot().distributionPending).toBe(false));
  setup.confirmRoster(); setup.assignRemaining(); setup.setPlayerName(1,name);
  return {app,setup,activated};
}
export async function started() { const result=await arranged(); await result.setup.confirm(); expect(result.app.getSnapshot().screen).toBe('play'); return result; }
export async function stored() { const result=await driver().loadSession(); if(result.status!=='loaded') throw Error(result.status); return result.snapshot; }
export function deferred<T>() { let resolve!:(value:T)=>void; let reject!:(reason:unknown)=>void; const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;}); return {promise,resolve,reject}; }
