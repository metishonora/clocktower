import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { CustomCanonicalSession } from "../../src/custom/session.js";
import { IndexedDbCustomWebSessionStorageDriver } from "../../src/custom/storage/sessionStorage.js";
import { parseReplayState } from "../../src/custom/core/validation.js";
import type { CustomScriptDefinition, SetupPlayerInput, PhaseStepInput, InformationResult, RegistrationJudgment } from "../../src/custom/core/types.js";
import { realWasmCore, replayOrThrow } from "./realCustomWasmHarness.js";
const seeds = JSON.parse(readFileSync(new URL("../../../fixtures/acceptance/custom-first-night/issue208/scenarios.json",import.meta.url),"utf8")) as {id:string;definition:CustomScriptDefinition;setupInput:{players:SetupPlayerInput[]}}[];
async function start(id:string, players?:SetupPlayerInput[]) {
  const seed=seeds.find(s=>s.id===id)!;const storage=new IndexedDbCustomWebSessionStorageDriver(seed.definition.id,new IDBFactory());
  players ??= seed.setupInput.players;
  const session=CustomCanonicalSession.create({definition:seed.definition,core:realWasmCore(),storage,setupDraft:{players},presentation:{},gameId:id,now:new Date("2026-09-08T00:00:00Z")});
  const setup=await session.confirmSetup({type:"createGame",payload:{players}});if(!setup.ok)throw Error(`${setup.error.code}: ${setup.error.messageKo}`);return {session,storage};
}
async function take(session:CustomCanonicalSession<unknown,unknown>,action:string,input:PhaseStepInput,deliveredResult?:InformationResult,registrationJudgments?:RegistrationJudgment[],optional=false){
  const state=await replayOrThrow(session.snapshot.canonical);const step=optional?state.availableActions?.find(s=>s.actionRef?.actionId===action):state.currentStep;
  expect(step?.actionRef?.actionId).toBe(action);
  const result=await session.execute({type:"confirmStep",payload:{stepId:step!.id,input,...(deliveredResult?{deliveredResult}:{}),...(registrationJudgments?{registrationJudgments}:{})}});if(!result.ok)throw Error(`${action}: ${result.error.code}: ${result.error.messageKo}`);expect(await result.value.autosave).toBe(true);return result.value;
}
async function system(session:CustomCanonicalSession<unknown,unknown>){await take(session,"minionInfo",null);await take(session,"demonInfo",{characterIds:["artist","savant","juggler"]});}
it("counts Drunk misinformation without audit answers through WASM, IndexedDB, reload and Undo",async()=>{
  const {session,storage}=await start("drunk-empath-math");await system(session);await take(session,"choosePoisonTarget",{playerIds:["monk"]});const before=await replayOrThrow(session.snapshot.canonical);
  const delivered=await take(session,"learnEvilNeighbors",null,{kind:"number",value:0});const after=await replayOrThrow(session.snapshot.canonical);
  expect(after.currentStep?.informationPrompt?.computedResult).toEqual({kind:"number",value:1});const audit=after.currentStep!.informationPrompt!.mathematicianAudit!;
  expect(audit.records[0]?.subjectPlayerId).toBe("drunk");expect(JSON.stringify(audit)).not.toContain("computedResult");
  const forged=structuredClone(after);const outcome=forged.currentStep!.informationPrompt!.mathematicianAudit!.records[0]!.evidence[0]!.outcome;Object.assign(outcome,{computedResult:{kind:"number",value:2}});expect(()=>parseReplayState(forged)).toThrow();
  const loaded=await CustomCanonicalSession.load({core:realWasmCore(),storage});if(loaded.status!=="loaded")throw Error(loaded.status);expect(await replayOrThrow(loaded.session.snapshot.canonical)).toEqual(after);
  const undo=await loaded.session.undo(delivered.proposal.event.id);if(!undo.ok)throw Error(undo.error.code);expect(await undo.value.autosave).toBe(true);expect(await replayOrThrow(loaded.session.snapshot.canonical)).toEqual(before);
});
it("preserves Chef scoped registration witnesses through the canonical parser",async()=>{
  const {session}=await start("chef-recluse-edge");await system(session);await take(session,"choosePoisonTarget",{playerIds:["monk"]});const state=await replayOrThrow(session.snapshot.canonical);const choice=state.currentStep!.informationPrompt!.numberChoices.find(c=>c.value===1)!;
  expect(choice.registrationJudgments.some(j=>j.scope?.kind==="adjacentPair")).toBe(true);
  const result=await take(session,"learnEvilPairs",null,{kind:"number",value:1},choice.registrationJudgments);expect(result.proposal.revealPayload).toEqual({kind:"numericInformation",characterId:"chef",value:1});
});
it("saves optional Mutant victory, exposes only the execution, and restores the prefix on Undo",async()=>{
  const {session,storage}=await start("mutant-good-twin");await take(session,"assignTwin",{playerIds:["mutant"]});const before=await replayOrThrow(session.snapshot.canonical);
  const executed=await take(session,"resolveMadnessExecution",{execute:true},undefined,undefined,true);const after=await replayOrThrow(session.snapshot.canonical);expect(after.gameEnd?.reason).toBe("goodTwinExecuted");expect(after.currentStep).toBeNull();expect(after.availableActions??[]).toEqual([]);expect(executed.proposal.revealPayload).not.toHaveProperty("winningAlignment");
  const loaded=await CustomCanonicalSession.load({core:realWasmCore(),storage});if(loaded.status!=="loaded")throw Error(loaded.status);expect(await replayOrThrow(loaded.session.snapshot.canonical)).toEqual(after);
  const undo=await loaded.session.undo(executed.proposal.event.id);if(!undo.ok)throw Error(undo.error.code);expect(await undo.value.autosave).toBe(true);expect(await replayOrThrow(loaded.session.snapshot.canonical)).toEqual(before);
});
it("keeps prepared information markers in a narrow Spy snapshot",async()=>{
  const roster=["washerwoman","mathematician","monk","virgin","slayer","spy","imp"];
  const players=roster.map((actualCharacter,i)=>({id:`p${i+1}`,seat:i+1,name:`P${i+1}`,actualCharacter}));const {session}=await start("drunk-empath-math",players);
  await take(session,"prepareInformation",{playerIds:["p1","p3"],characterId:"monk",correctPlayerId:"p3"});await system(session);
  const delivery=await take(session,"learnTownsfolk",null);expect(delivery.proposal.revealPayload).toMatchObject({kind:"setupInformation",revealedCharacterId:"monk"});
  const spy=await take(session,"inspectGrimoire",null);expect(spy.proposal.revealPayload).toMatchObject({kind:"spyGrimoire"});if(!spy.proposal.revealPayload || !("kind" in spy.proposal.revealPayload) || spy.proposal.revealPayload.kind!=="spyGrimoire")throw Error("spy");
  expect(spy.proposal.revealPayload.players[2]).toMatchObject({characterId:"monk",alignment:"good",automaticReminders:[{tokenId:"townsfolk"}]});expect(spy.proposal.revealPayload).not.toHaveProperty("computedResult");
});
it("runs all nine TB actions with mixed SnV guidance and retained Spy markers through Dawn",async()=>{
  const roster=["washerwoman","librarian","investigator","chef","empath","fortuneTeller","mathematician","monk","soldier","butler","drunk","poisoner","spy","scarletWoman","imp"];
  const players=roster.map((actualCharacter,i)=>({id:`p${i+1}`,seat:i+1,name:`P${i+1}`,actualCharacter,...(actualCharacter==="drunk"?{shownCharacter:"clockmaker"}:{})}));
  const {session,storage}=await start("drunk-empath-math",players);
  for(const [characterId,correctPlayerId] of [["monk","p8"],["butler","p10"],["poisoner","p12"]]) await take(session,"prepareInformation",{playerIds:["p1",correctPlayerId!],characterId,correctPlayerId});
  await take(session,"assignRedHerring",{playerIds:["p8"]});await system(session);await take(session,"choosePoisonTarget",{playerIds:["p11"]});
  for(const action of ["learnTownsfolk","learnOutsider","learnMinion","learnEvilPairs","learnEvilNeighbors"]) await take(session,action,null);
  await take(session,"checkDemon",{playerIds:["p6","p15"]});await take(session,"chooseMaster",{playerIds:["p8"]});await take(session,"learnSteps",null,{kind:"number",value:0});
  const spy=await take(session,"inspectGrimoire",null);expect(spy.proposal.revealPayload).toMatchObject({kind:"spyGrimoire"});
  const math=await take(session,"learnCount",null);expect(math.proposal.revealPayload).toMatchObject({kind:"numericInformation",value:1});await take(session,"dawn",null);
  const state=await replayOrThrow(session.snapshot.canonical);expect(state.phase).toBe("day");expect(state.ruleState.poisonerChoices?.[0]?.effective).toBe(true);expect(state.ruleState.masterChoices?.[0]?.targetPlayerId).toBe("p8");
  const loaded=await CustomCanonicalSession.load({core:realWasmCore(),storage});if(loaded.status!=="loaded")throw Error(loaded.status);expect(await replayOrThrow(loaded.session.snapshot.canonical)).toEqual(state);
});
it("keeps an impaired Spy's alternate delivery separate from actual players",async()=>{
  const roster=["washerwoman","mathematician","monk","virgin","slayer","soldier","chef","poisoner","spy","imp"];
  const {session}=await start("drunk-empath-math",roster.map((actualCharacter,i)=>({id:`p${i+1}`,seat:i+1,name:`P${i+1}`,actualCharacter})));
  await take(session,"prepareInformation",{playerIds:["p1","p3"],characterId:"monk",correctPlayerId:"p3"});await system(session);await take(session,"choosePoisonTarget",{playerIds:["p9"]});await take(session,"learnTownsfolk",null);await take(session,"learnEvilPairs",null);
  const before=await replayOrThrow(session.snapshot.canonical);const alternate=structuredClone(before.currentStep!.informationPrompt!.computedResult!);if(alternate.kind!=="spyGrimoire")throw Error("spy");alternate.players[0]!.characterId="artist";alternate.players[0]!.alive=false;
  const delivered=await take(session,"inspectGrimoire",null,alternate);const after=await replayOrThrow(session.snapshot.canonical);expect(after.players).toEqual(before.players);expect(delivered.proposal.revealPayload).toMatchObject({kind:"spyGrimoire",players:expect.arrayContaining([expect.objectContaining({characterId:"artist",alive:false})])});expect(after.currentStep?.informationPrompt?.computedResult).toEqual({kind:"number",value:1});
});
