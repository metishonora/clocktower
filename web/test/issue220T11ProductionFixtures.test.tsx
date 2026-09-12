import {it} from 'vitest';
import {writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {t11Definition} from './custom/issue220T11Support';
it('exports a Core-validated scenario for the real T11 setup route',async()=>{
 const {definition}=await t11Definition();const {id,...scenario}=definition;
 const path=(Reflect.get(process,'env') as Record<string,string|undefined>).ISSUE220_T11_SCENARIO;
 if(path){mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify({type:'clocktower-custom-scenario',version:1,scenario}));}
});
