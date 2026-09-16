import { expect, test } from 'vitest';
import { phaseActionChoiceLabel, phaseOverviewLabel } from '../../src/custom/grimoire/historyModel';
import type { PhaseStep, ReplayState } from '../../src/custom/core/types';
const replay={players:[{id:'p1',seat:1,name:'긴 플레이어 이름',actualCharacter:'philosopher'},{id:'p2',seat:2,name:'P2',actualCharacter:'drunk',shownCharacter:'empath'}]} as ReplayState;
function step(character:string,actionId:string,playerId='p1'):PhaseStep {return {execution:{id:'label',rootStepId:'label',displayStepId:'label',relation:'independent'},id:`${character}:${actionId}`,phase:'firstNight',stepType:'character',character,playerId,canSkip:false,requiredInput:{kind:'none',optional:false},actionRef:{kind:'character',characterId:character,actionId}};}
test('compact overview follows TB roles/factions without names, seats or action prose',()=>{
  expect(phaseOverviewLabel(step('chef','learnEvilPairs'),replay)).toBe('요리사');
  for(const [actionId,label] of [['minionInfo','하수인'],['demonInfo','악마'],['dawn','낮 시작']] as const)expect(phaseOverviewLabel({...step('chef','learnEvilPairs'),character:undefined,actionRef:{kind:'system',actionId}},replay)).toBe(label);
});
test('acquired/shown identities stay distinguishable; preparation/delivery share the approved role label',()=>{
  const acquired={...step('washerwoman','prepareInformation'),abilityOrigin:{kind:'acquired',acquisitionEventId:'e1',source:{ownerPlayerId:'p1',characterId:'philosopher',abilityInstanceId:'a1'}}} as PhaseStep;
  expect(phaseOverviewLabel(acquired,replay)).toBe('철학자 · 세탁부');
  expect(phaseActionChoiceLabel(acquired,replay)).toBe('철학자 · 세탁부');
  expect(phaseActionChoiceLabel({...acquired,actionRef:{kind:'character',characterId:'washerwoman',actionId:'learnTownsfolk'}},replay)).toBe('철학자 · 세탁부');
  expect(phaseOverviewLabel(step('empath','learnEvilNeighbors','p2'),replay)).toBe('주정뱅이 · 초공감자');
});
