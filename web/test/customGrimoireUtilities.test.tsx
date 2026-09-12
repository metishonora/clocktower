import { expect, test } from 'vitest';
import { buildCustomReport } from '../src/grimoire-custom/CustomUtilities';
import type { GameFileV4 } from '../src/custom/core/types';

test('custom bug reports remove names/memos while retaining reproducible custom events; original is opt-in',()=>{
  const definition={id:'scenario-1',name:'개인 시나리오',characterIds:['chef'],firstNightOrder:[]};
  const file:GameFileV4={schemaVersion:4,game:{id:'game-1',name:'개인 게임',script:{type:'custom',definition},createdAt:'2026-09-11',updatedAt:'2026-09-11',events:[{id:'event-1',type:'setupConfirmed',phase:'setup',summary:'비공개 이름의 설정',createdAt:'2026-09-11',payload:{players:[{id:'p1',seat:1,name:'비공개 이름',actualCharacter:'chef'}]}}]}};
  const source={definition,file,note:'비공개 메모'};
  const args={gameFile:source,symptom:'진행 오류',environment:{appVersion:'test',buildCommit:'test',pageUrl:'https://example.test',userAgent:'test',viewport:{width:320,height:900}},reproductionContext:{eventCount:1,phase:'play'},includeOriginalGameFile:false};
  const before=JSON.stringify(source);const result=buildCustomReport(args);const report=JSON.parse(result.attachmentJson);
  expect(result.attachmentJson).not.toMatch(/비공개|개인/);expect(report.original).toBeUndefined();
  expect(report.fixture.file.game.events[0]).toMatchObject({id:'event-1',type:'setupConfirmed',payload:{players:[{id:'p1',seat:1,name:'익명',actualCharacter:'chef'}]}});
  expect(report.fixture.definition.id).toBe('scenario-1');expect(JSON.stringify(source)).toBe(before);
  expect(JSON.parse(buildCustomReport({...args,includeOriginalGameFile:true}).attachmentJson).original).toEqual(source);
  expect(buildCustomReport({...args,gameFile:{definition}}).fixture.definition.id).toBe('scenario-1');
});
