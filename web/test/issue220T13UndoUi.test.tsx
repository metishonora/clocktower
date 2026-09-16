import {expect,it,vi} from 'vitest';
import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {CustomGrimoirePlay} from '../src/grimoire-custom/CustomGrimoirePlay';
import {actionFixture,actionCases,confirmFixture} from './custom/issue220T13Support';
import {resume} from './custom/issue220T10TestSupport';
it('T13 P5 U01: empty Undo has BMR empty state and accessible name',async()=>{
 const f=await actionFixture(actionCases[1]),app=await resume(f.session.snapshot.canonical);
 try{render(<CustomGrimoirePlay controller={app.play!} onNewGame={()=>{}} onImport={()=>{}} onRestart={()=>{}}/>);
 const button=screen.getByRole('button',{name:'되돌릴 행동 없음'});expect(button).toHaveProperty('disabled',true);expect(button.className.split(' ')).toContain('empty');
 }finally{app.dispose();}
});
for(const accept of [false,true])it(`T13 P5 U02/U03: in-app confirmation ${accept?'accept':'cancel'} identifies the same dependency execution it removes`,async()=>{
 const f=await actionFixture(actionCases.find(c=>c[0]==='R27')!);const before=f.session.snapshot.canonical.game.events.slice(0,-1);await confirmFixture(f);
 const app=await resume(f.session.snapshot.canonical),confirm=vi.spyOn(window,'confirm').mockReturnValue(accept);
 try{const p=app.play!,file=structuredClone(p.getSnapshot().file);render(<CustomGrimoirePlay controller={p} onNewGame={()=>{}} onImport={()=>{}} onRestart={()=>{}}/>);
 fireEvent.click(screen.getByRole('button',{name:/최근 행동 되돌리기:.*쌍둥이/}));
 expect(confirm).not.toHaveBeenCalled();const text=screen.getByRole('dialog',{name:'Undo'}).textContent!;expect(text).toContain('쌍둥이');expect(text).not.toMatch(/learnTwin|firstNight|phase-step|abilityInstance/);
 fireEvent.click(screen.getByRole('button',{name:accept?'되돌리기':'취소'}));
 if(accept)await waitFor(()=>expect(p.getSnapshot().file.game.events).toEqual(before));else expect(p.getSnapshot().file).toEqual(file);
 }finally{app.dispose();}
});
it('T13 P5 U04: public reveal cannot invoke Undo',async()=>{
 const f=await actionFixture(actionCases[2]),app=await resume(f.session.snapshot.canonical),confirm=vi.spyOn(window,'confirm').mockReturnValue(true);
 try{const p=app.play!;render(<CustomGrimoirePlay controller={p} onNewGame={()=>{}} onImport={()=>{}} onRestart={()=>{}}/>);
 await act(async()=>p.prepare({input:f.input}));const before=structuredClone(p.getSnapshot().file);
 expect(p.getSnapshot().public).toBe(true);await act(async()=>p.undo());expect(p.getSnapshot().file).toEqual(before);expect(confirm).not.toHaveBeenCalled();
 }finally{app.dispose();}
});
