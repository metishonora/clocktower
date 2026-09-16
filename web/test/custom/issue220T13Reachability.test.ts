import {expect,it} from 'vitest';
import {actionCases,actionFixture,confirmFixture} from './issue220T13Support';
// Independent from missing execution metadata: each test must reach a real legal command.
for(const c of actionCases)it(`T13 reachable ${c[0]} ${c[1]}.${c[2]} confirms through Production Core`,async()=>{
 const f=await actionFixture(c),before=f.session.snapshot.canonical.game.events.length;
 if(c[2]==='dusk'){expect(f.step).toBeDefined();expect(f.session.replay!.currentStep!.actionRef?.actionId).toBe('minionInfo');return;}
 const event=await confirmFixture(f);expect(f.session.snapshot.canonical.game.events).toHaveLength(before+1);expect(event).toHaveProperty('id');
});
