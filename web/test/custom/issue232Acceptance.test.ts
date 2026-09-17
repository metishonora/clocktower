import { afterAll, it } from 'vitest';
import { game01, game02, game03, game04, game05 } from './issue232Games.js';
import type { AcceptanceGame } from './issue232Support.js';
import { validateCoverage, writeArtifacts } from './issue232Artifacts.js';
const games:AcceptanceGame[]=[];
for(const [name,build] of ([
 ['G01: 복합 정보·등록·주정뱅이 징크스·낮·종료',game01],
 ['G02: 보호·사망·계승·셋째 밤·정체 교환·종료',game02],
 ['G03: Vortox·낮 근거·쌍둥이·광기·얼뜨기·종료',game03],
 ['G04: 획득·시작 정보·Sage Jinx·Fang Gu 이동·Snake Charmer',game04],
 ['G05: Vigor 유지 능력·필수 후속·No Dashii 변경·종료',game05],
] as const).filter(([name])=>!process.env.ISSUE232_GAME||name.startsWith(`${process.env.ISSUE232_GAME}:`)))it(name,async()=>{games.push(await build());},120000);
afterAll(async()=>{
 if(process.env.ISSUE232_GAME==='G05'&&games.length===1) {
  if(process.env.ISSUE232_WRITE==='1')await writeArtifacts(games,true);
  return;
 }
 if(games.length!==5)return;
 await validateCoverage(games);
 if(process.env.ISSUE232_WRITE==='1')await writeArtifacts(games);
},120000);
