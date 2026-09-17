import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {automaticReminderPairs} from '../src/custom/core/automaticReminderTokens';
import {customPlayerTokens} from '../src/grimoire-custom/customPlayerPresentation';
import {parseGameFileJson} from '../src/custom/storage/gameFile';
import {replayOrThrow} from './custom/realCustomWasmHarness';

it('every supported automatic token displays Korean even when the saved label and description are identifiers',()=>{
 const reminders=[...automaticReminderPairs].map(pair=>{
  const [characterId,tokenId]=pair.split(':');
  return {playerId:'p1',characterId,tokenId,label:tokenId,description:tokenId};
 });
 for(const token of customPlayerTokens(reminders)){
  expect(token.label).toMatch(/[가-힣]/);
  expect(token.description).toMatch(/[가-힣]/);
  expect(token.sourceLabel).toMatch(/[가-힣]/);
 }
});
it('G05 protection and retained ability tokens use Korean without losing counts or inactive status',async()=>{
 const replay=await replayOrThrow(parseGameFileJson(readFileSync('../fixtures/acceptance/custom-composite/G05-vigor-poison-pending.game.json','utf8')));
 const tokens=customPlayerTokens(replay.ruleState.automaticReminders??[]);
 expect(tokens).toEqual(expect.arrayContaining([
  expect.objectContaining({sourceLabel:'수도사',label:'안전',description:'안전'}),
  expect.objectContaining({sourceLabel:'비고르모르티스',label:'능력 있음',description:'능력 있음'}),
 ]));
 expect(customPlayerTokens([{playerId:'p1',characterId:'juggler',tokenId:'correct',label:'정답',description:'어젯밤 추측한 정답 수입니다.',count:2,inactiveReason:'능력 비활성'}])[0]).toMatchObject({description:'어젯밤 추측한 정답 수입니다.',count:2,inactiveReason:'능력 비활성'});
});
