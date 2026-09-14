import type {DayConfirmed,DayView} from './dayTypes.js';
import {isCustomGameEnd} from './customActionResultValidationBase.js';
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const keys=(v:Record<string,unknown>, k:string[])=>Object.keys(v).length===k.length&&k.every(key=>key in v);
const id=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0;
const ids=(v:unknown):v is string[]=>Array.isArray(v)&&v.every(id)&&new Set(v).size===v.length;
const optionalId=(v:unknown)=>v===null||id(v);
const integer=(v:unknown)=>Number.isSafeInteger(v)&&(v as number)>=0;
const stages=['announcement','whisper','discussion','nomination','voting','execution','executionDeath','death','nightReady','night'];
const list=(v:unknown,f:(item:unknown)=>boolean)=>Array.isArray(v)&&v.every(f);
const bool=(v:unknown)=>typeof v==='boolean';
const alignment=(v:unknown)=>v==='good'||v==='evil';
type Validators={ability:(v:unknown)=>boolean;impairment:(v:unknown)=>boolean;character:(v:unknown)=>boolean;simulation:(v:unknown)=>boolean};
function abilityInput(v:unknown):boolean{
 if(!obj(v))return false;
 const text=(t:unknown)=>typeof t==='string'&&t.trim()===t&&[...t].length<=500;
 switch(v.kind){
  case 'artist':return keys(v,['kind','question','answer','truthful'])&&text(v.question)&&['yes','no','unknown'].includes(v.answer as string)&&bool(v.truthful);
  case 'savant':return keys(v,['kind','statements'])&&Array.isArray(v.statements)&&v.statements.length===2&&v.statements.every(s=>obj(s)&&keys(s,['text','truthful'])&&text(s.text)&&bool(s.truthful));
  case 'juggler':return keys(v,['kind','correctCount'])&&integer(v.correctCount)&&Number(v.correctCount)<=5;
  case 'slayer':return keys(v,['kind','targetPlayerId','recluseAsDemon'])&&id(v.targetPlayerId)&&bool(v.recluseAsDemon);
  default:return false;
 }
}
function input(v:unknown):boolean {
  if(!obj(v))return false;
  switch(v.kind){
    case 'advance':case 'closeNominations':case 'confirmDeath':case 'confirmExecution':case 'beginNight':case 'confirmGameEnd':return keys(v,['kind']);
    case 'nominate':return keys(v,['kind','nominatorId','nomineeId','spyAsTownsfolk'])&&id(v.nominatorId)&&id(v.nomineeId)&&bool(v.spyAsTownsfolk);
    case 'vote':return keys(v,['kind','voterIds'])&&ids(v.voterIds);
    case 'endGame':return keys(v,['kind','winningAlignment'])&&alignment(v.winningAlignment);
    case 'useAbility':return keys(v,['kind','actionId','record'])&&id(v.actionId)&&abilityInput(v.record);
    case 'checkMadness':return keys(v,['kind','assignmentId','violation'])&&id(v.assignmentId)&&bool(v.violation);
    case 'executeMadness':return keys(v,['kind','assignmentId'])&&id(v.assignmentId);
    case 'resolveConsequence':return keys(v,['kind','consequenceId','playerId'])&&id(v.consequenceId)&&optionalId(v.playerId);
    default:return false;
  }
}
function participant(p:unknown,check:Validators):boolean{
 return obj(p)&&keys(p,['playerId','characterId','alignment','characterKind','alive','ghostVoteUsed','abilities','impairments'])&&id(p.playerId)&&check.character(p.characterId)&&alignment(p.alignment)&&['Townsfolk','Outsider','Minion','Demon'].includes(p.characterKind as string)&&bool(p.alive)&&bool(p.ghostVoteUsed)&&list(p.abilities,check.ability)&&list(p.impairments,check.impairment);
}
const participants=(v:unknown,c:Validators)=>list(v,p=>participant(p,c));
function pendingDeath(v:unknown,c:Validators):boolean{return obj(v)&&keys(v,['playerId','cause','source','rootEventId','resumeStage'])&&id(v.playerId)&&['execution','virgin','madness','witch','slayer'].includes(v.cause as string)&&(v.source===null||c.ability(v.source))&&id(v.rootEventId)&&stages.includes(v.resumeStage as string);}
function consequence(v:unknown,c:Validators):boolean{return obj(v)&&keys(v,['id','deathEventId','source','impairedAtDeath','alignmentAtDeath','resolved','targetPlayerId'])&&id(v.id)&&id(v.deathEventId)&&c.ability(v.source)&&bool(v.impairedAtDeath)&&alignment(v.alignmentAtDeath)&&bool(v.resolved)&&optionalId(v.targetPlayerId);}
function action(v:unknown,c:Validators):boolean{return obj(v)&&keys(v,['id','actorPlayerId','characterId','abilityUse','simulationSource','effective','impaired','vortox'])&&id(v.id)&&id(v.actorPlayerId)&&c.character(v.characterId)&&((v.abilityUse===null&&c.simulation(v.simulationSource))||(c.ability(v.abilityUse)&&v.simulationSource===null))&&[v.effective,v.impaired,v.vortox].every(bool);}
function record(v:unknown,c:Validators):boolean{return obj(v)&&keys(v,['eventId','day','action','record'])&&id(v.eventId)&&integer(v.day)&&Number(v.day)>0&&action(v.action,c)&&abilityInput(v.record);}
function madness(v:unknown,c:Validators):boolean{return obj(v)&&keys(v,['id','source','targetPlayerId','characterId','effective','violation','canCheck','canExecute'])&&id(v.id)&&c.ability(v.source)&&id(v.targetPlayerId)&&(v.characterId===null||c.character(v.characterId))&&[v.effective,v.canCheck,v.canExecute].every(bool)&&(v.violation===null||bool(v.violation));}
function pending(v:Record<string,unknown>,c:Validators):boolean{return (v.pendingDeath===null||pendingDeath(v.pendingDeath,c))&&(v.pendingGameEnd===null||isCustomGameEnd(v.pendingGameEnd))&&list(v.consequences,x=>consequence(x,c));}
export function isDayConfirmed(v:unknown,check:Validators):v is DayConfirmed {
  if(!obj(v)||!keys(v,['stepId','day','input','result'])||!id(v.stepId)||!integer(v.day)||Number(v.day)<1||!input(v.input)||!obj(v.result))return false;
  const r=v.result;
  return keys(r,['stage','participants','countedVoterIds','ghostVoteSpentPlayerIds','deathPlayerIds','abilityRecord','pendingDeath','pendingGameEnd','consequences'])&&stages.includes(r.stage as string)&&participants(r.participants,check)&&ids(r.countedVoterIds)&&ids(r.ghostVoteSpentPlayerIds)&&ids(r.deathPlayerIds)&&(r.abilityRecord===null||record(r.abilityRecord,check))&&pending(r,check);
}
export function isDayView(v:unknown,check:Validators):v is DayView {
  if(!obj(v)||!keys(v,['voteDependencies','townsfolkRegistrationNominatorIds','firstNominationTargetIds','demonRegistrationTargetIds','day','stage','stepId','nominations','execution','eligibleNominatorIds','eligibleNomineeIds','eligibleVoterIds','executionVoteThreshold','highestVoteCount','executionCandidateId','availableActions','abilityRecords','madness','pendingDeath','pendingGameEnd','consequences','deaths']))return false;
  const e=v.execution;
  return ids(v.townsfolkRegistrationNominatorIds)&&ids(v.firstNominationTargetIds)&&ids(v.demonRegistrationTargetIds)&&list(v.voteDependencies,d=>obj(d)&&keys(d,['voterId','requiredVoterId'])&&id(d.voterId)&&id(d.requiredVoterId))&&integer(v.day)&&Number(v.day)>0&&stages.includes(v.stage as string)&&id(v.stepId)&&ids(v.eligibleNominatorIds)&&ids(v.eligibleNomineeIds)&&ids(v.eligibleVoterIds)&&integer(v.executionVoteThreshold)&&integer(v.highestVoteCount)&&optionalId(v.executionCandidateId)&&pending(v,check)&&list(v.availableActions,a=>action(a,check))&&list(v.abilityRecords,r=>record(r,check))&&list(v.madness,m=>madness(m,check))&&list(v.deaths,d=>obj(d)&&keys(d,['eventId','day','cause','participant'])&&id(d.eventId)&&integer(d.day)&&Number(d.day)>0&&pendingDeath(d.cause,check)&&participant(d.participant,check))&&
    (e===null||(obj(e)&&keys(e,['eventId','playerId','deathEventId','died'])&&id(e.eventId)&&optionalId(e.playerId)&&optionalId(e.deathEventId)&&bool(e.died)))&&
    Array.isArray(v.nominations)&&v.nominations.every(n=>obj(n)&&keys(n,['eventId','nominatorId','nomineeId','nominationParticipants','voteParticipants','voterIds','countedVoterIds','ghostVoteSpentPlayerIds'])&&id(n.eventId)&&id(n.nominatorId)&&id(n.nomineeId)&&participants(n.nominationParticipants,check)&&(n.voteParticipants===null||participants(n.voteParticipants,check))&&(n.voterIds===null||ids(n.voterIds))&&(n.countedVoterIds===null||ids(n.countedVoterIds))&&ids(n.ghostVoteSpentPlayerIds));
}
