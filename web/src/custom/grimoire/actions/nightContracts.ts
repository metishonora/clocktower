import type {ActionAdapter} from './registry';
export const directNightAction: ActionAdapter = {stage:'action',inputView:'players',acceptedInputs:['playerIds'],selectionContract:'direct',completionContract:{afterSelection:'confirm',continuationEntry:'edit'},revealView:'none',revealOpen:'result',closeDestination:'progress',cancellation:'discardInput'};
export const nightInformation: ActionAdapter = {stage:'delivery',inputView:'information',acceptedInputs:['none'],selectionContract:'none',completionContract:{afterSelection:'edit',continuationEntry:'edit'},revealView:'snv',revealOpen:'preview',closeDestination:'progress',cancellation:'discardInput'};

export const nightAttack: ActionAdapter = {...directNightAction,resultReview:'attack'};
