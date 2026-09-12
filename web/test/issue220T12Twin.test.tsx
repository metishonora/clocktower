import {it,expect} from 'vitest';
import {startT11} from './custom/issue220T11Support';
it('T12 audits the actual twin assignment and information event link',async()=>{
 const app=await startT11(['soldier','mayor','monk','virgin','slayer','evilTwin','imp']);
 try {
  const p=app.play!,s=p.session;
  const trace=[];
  for(let i=0;i<5;i++){
   const step=s.replay!.currentStep!;if(!step)break;
   trace.push({action:step.actionRef,cause:step.actionCause,flow:step.informationFlow});
   const inputs:Record<string,import('../src/custom/core/types').PhaseStepInput>={minionInfo:null,demonInfo:{characterIds:['washerwoman','librarian','chef']},assignTwin:{playerIds:[s.replay!.players[0].id]},learnTwin:null};
   const action=step.actionRef!.actionId;if(!Object.hasOwn(inputs,action))break;
   const result=await s.execute({type:'confirmStep',payload:{stepId:step.id,input:inputs[action]}});expect(result.ok,JSON.stringify(result)).toBe(true);
  }
  expect(trace.map(t=>t.action?.actionId)).toEqual(['minionInfo','demonInfo','assignTwin','learnTwin','dawn']);
  const [assignment,delivery]=s.snapshot.canonical.game.events.slice(-2);
  expect(assignment).toMatchObject({type:'customActionConfirmed',payload:{result:{kind:'twinAssigned',targetPlayerId:'player-1'}}});
  expect(delivery).toMatchObject({type:'customActionConfirmed',payload:{result:{kind:'twinInformed',relationshipEventId:assignment.id,targetPlayerId:'player-1'}}});

 }finally{app.dispose();}
});
