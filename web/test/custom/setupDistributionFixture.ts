import type {SetupDistribution,SetupDistributionResult} from '../../src/custom/core/types';
/** Non-rule session mocks use an unchanged distribution; real-rule tests use WASM. */
export function unmodifiedDistribution(base:SetupDistribution):SetupDistributionResult {
 const zero={Townsfolk:0,Outsider:0,Minion:0,Demon:0};
 return {...base,adjustment:{base:{...base},modifiers:[],requestedDelta:{...zero},appliedDelta:{...zero},limited:false}};
}
