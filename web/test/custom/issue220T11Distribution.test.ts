import {expect,it} from 'vitest';
import {setup_distribution} from '../../src/generated/clocktower_custom_wasm/clocktower_custom_wasm';
import {parseSetupDistribution} from '../../src/custom/core/validation';
import {t11Definition} from './issue220T11Support';
const count=(t:number,o:number,m=1,d=1)=>({Townsfolk:t,Outsider:o,Minion:m,Demon:d});
const delta=(o:number)=>count(o===0?0:-o,o,0,0);
// Direct WASM JSON checks the producer independently of the frontend parser.
for(const c of [
 {name:'M01 Vigormortis 8',n:8,ids:['vigormortis'],base:count(5,1),final:count(6,0),requested:-1,applied:-1},
 {name:'M02 lower limit 7',n:7,ids:['vigormortis'],base:count(5,0),final:count(5,0),requested:-1,applied:0},
 {name:'M03 Fang Gu',n:7,ids:['fangGu'],base:count(5,0),final:count(4,1),requested:1,applied:1},
 {name:'M03 Baron',n:7,ids:['baron'],base:count(5,0),final:count(3,2),requested:2,applied:2},
 {name:'M04 aggregate before clamp',n:7,ids:['baron','vigormortis'],base:count(5,0),final:count(4,1),requested:1,applied:1},
 {name:'M04 positive modifiers combine',n:7,ids:['baron','fangGu'],base:count(5,0),final:count(2,3),requested:3,applied:3},
 {name:'M05 candidates alone do not apply',n:7,ids:['imp'],base:count(5,0),final:count(5,0),requested:0,applied:0},
])it(`T11 ${c.name}: causes and applied numbers accompany the actual distribution`,async()=>{
 const {definition}=await t11Definition();
 const result=JSON.parse(setup_distribution(JSON.stringify({customDefinition:definition,playerCount:c.n,actualCharacters:c.ids})));
 expect(result.ok).toBe(true);expect(result.value).toMatchObject(c.final);
 const sources=definition.characterIds.filter(id=>c.ids.includes(id)&&['baron','fangGu','vigormortis'].includes(id)).map(characterId=>({characterId,delta:delta(characterId==='baron'?2:characterId==='fangGu'?1:-1)}));
 expect(result.value.adjustment).toEqual({base:c.base,modifiers:sources,requestedDelta:delta(c.requested),appliedDelta:delta(c.applied),limited:c.requested!==c.applied});
});
it('T11 M04 selection order and duplicate IDs do not multiply modifiers',async()=>{
 const {definition}=await t11Definition();
 const query=(actualCharacters:string[])=>JSON.parse(setup_distribution(JSON.stringify({customDefinition:definition,playerCount:7,actualCharacters}))).value;
 expect(query(['baron','vigormortis'])).toEqual(query(['vigormortis','baron','baron']));
});
it('T11 existing insufficient-candidate errors must not become a partial success',async()=>{
 const {definition}=await t11Definition();
 const characterIds=definition.characterIds.filter(id=>!['recluse','drunk','saint','butler','mutant','sweetheart','barber','klutz'].includes(id));
 const customDefinition={...definition,characterIds,firstNightOrder:definition.firstNightOrder.filter(r=>r.kind!=='character'||characterIds.includes(r.characterId))};
 const result=JSON.parse(setup_distribution(JSON.stringify({customDefinition,playerCount:7,actualCharacters:['fangGu']})));
 expect(result.ok).toBe(false);expect(result.error.code).toBe('INSUFFICIENT_SETUP_ROSTER');
});
function valid(){return {...count(4,1),adjustment:{base:count(5,0),modifiers:[{characterId:'baron',delta:delta(2)},{characterId:'vigormortis',delta:delta(-1)}],requestedDelta:delta(1),appliedDelta:delta(1),limited:false}};}
it('T11 parser accepts the approved signed, aggregate projection',()=>{const input=valid();expect(parseSetupDistribution(input)).toEqual(input);});
for(const [name,change] of [
 ['missing metadata',(x:Record<string,any>)=>{delete x.adjustment;}],
 ['inconsistent final count',(x:Record<string,any>)=>{x.Townsfolk=5;}],
 ['incorrect aggregate',(x:Record<string,any>)=>{x.adjustment.requestedDelta=delta(2);} ],
 ['duplicate source',(x:Record<string,any>)=>{x.adjustment.modifiers.push(x.adjustment.modifiers[0]);}],
 ['fractional signed delta',(x:Record<string,any>)=>{x.adjustment.appliedDelta.Outsider=.5;}],
 ['incorrect limit flag',(x:Record<string,any>)=>{x.adjustment.limited=true;}],
] as const)it(`T11 parser rejects ${name}`,()=>{const input=valid();change(input);expect(()=>parseSetupDistribution(input)).toThrow();});
