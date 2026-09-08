import { describe, it, expect } from "vitest";
import { isActionCause, isGuidanceCause, isCustomGameEnd, isCustomActionResult } from "../../src/custom/core/customActionResultValidationBase.js";
const known=(v:unknown):v is string => typeof v === "string" && ["drunk","empath","mutant"].includes(v);
const result=(v:unknown)=>isCustomActionResult(v,known,()=>false);
describe("#208 finite additional action contracts",()=>{
  it("accepts typed decisions and rejects a client-supplied winner or arbitrary patch",()=>{
    const execution={kind:"mutantExecution",execute:true,executed:true,died:true};
    expect(result(execution)).toBe(true);
    expect(result({...execution,winner:"evil"})).toBe(false);
    expect(result({kind:"statePatch",alive:false})).toBe(false);
    expect(result({kind:"shownCharacterAssigned",characterId:"mutant"})).toBe(true); // Membership/kind meaning remains Rust-owned.
    expect(result({kind:"shownCharacterAssigned",characterId:"unknown"})).toBe(false);
  });
  it("requires exact causal fields and known terminal reasons",()=>{
    expect(isActionCause({kind:"optional",prefixEventId:"e1"})).toBe(true);
    expect(isActionCause({kind:"optional",prefixEventId:" "})).toBe(false);
    expect(isActionCause({kind:"optional",prefixEventId:"e1",cursor:1})).toBe(false);
    expect(isGuidanceCause({kind:"choice",parentEventId:"e1"})).toBe(true);
    expect(isGuidanceCause({kind:"initialDrunk",parentEventId:"e1"})).toBe(false);
    const end={winningAlignment:"evil",reason:"goodTwinExecuted",sourceEventId:"execution"};
    expect(isCustomGameEnd(end)).toBe(true);
    expect(isCustomGameEnd({...end,reason:"unknown"})).toBe(false);
    expect(isCustomGameEnd({...end,sourceEventId:""})).toBe(false);
  });
});
