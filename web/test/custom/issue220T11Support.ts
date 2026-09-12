import {expect,vi} from 'vitest';
import {customScriptCharacters} from '../../src/custom/characterCatalog';
import {customFirstNightPlan,loadCustomDefinitionValidator} from '../../src/custom/core/wasmClient';
import {validateScenarioCandidate} from '../../src/custom/core/definitionValidator';
import {CustomGrimoireApplicationController} from '../../src/custom/grimoire/applicationController';
import {realWasmCore} from './realCustomWasmHarness';
import type {CoreAdapter} from '../../src/custom/core/coreAdapter';
export async function t11Definition(){
 realWasmCore();
 const draft={id:'issue220-t11',name:'T11',characterIds:customScriptCharacters.map(c=>c.id)};
 const plan=await customFirstNightPlan(draft);if(!plan.ok)throw Error(plan.error.messageKo);
 return validateScenarioCandidate({...draft,firstNightOrder:plan.value.plan},loadCustomDefinitionValidator);
}
export async function t11Setup(core:CoreAdapter=realWasmCore()){
 const app=new CustomGrimoireApplicationController(core,vi.fn());app.startSetup(await t11Definition());
 await settle(app);return app;
}
export async function settle(app:CustomGrimoireApplicationController){await vi.waitFor(()=>expect(app.setup!.getSnapshot().distributionPending).toBe(false));}
export async function selectRoles(app:CustomGrimoireApplicationController,roles:string[]){
 app.setup!.setPlayerCount(roles.length);await settle(app);
 for(const id of roles){app.setup!.toggleCharacter(id);await settle(app);}
 expect(app.setup!.getSnapshot().draft.selectedIds).toEqual(roles);
}
export const vigormortisRoster=['soldier','mayor','monk','virgin','slayer','poisoner','vigormortis'];
export const mutantRoster=['soldier','mayor','monk','virgin','slayer','mutant','poisoner','imp'];
export async function startT11(roles=vigormortisRoster){
 const app=await t11Setup();await selectRoles(app,roles);
 app.setup!.confirmRoster();roles.forEach((id,i)=>app.setup!.assignCharacter(i+1,id));await app.setup!.confirm();
 expect(app.getSnapshot().screen).toBe('play');expect(app.play).toBeDefined();return app;
}
