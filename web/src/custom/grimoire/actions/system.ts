import type {ActionAdapter} from './registry';
export const systemActions={
 'system.dusk':{stage:'transition',inputView:'none',acceptedInputs:['none'],selectionContract:'none',completionContract:{afterSelection:'edit',continuationEntry:'edit'},revealView:'none',revealOpen:'result',closeDestination:'progress',cancellation:'discardInput'},
 'system.minionInfo':{stage:'delivery',inputView:'team',acceptedInputs:['none'],selectionContract:'none',completionContract:{afterSelection:'edit',continuationEntry:'edit'},revealView:'team',revealOpen:'preview',closeDestination:'progress',cancellation:'discardInput'},
 'system.demonInfo':{stage:'delivery',inputView:'team',acceptedInputs:['characterIds'],selectionContract:'none',completionContract:{afterSelection:'edit',continuationEntry:'edit'},revealView:'team',revealOpen:'preview',closeDestination:'progress',cancellation:'discardInput'},
 'system.dawn':{stage:'transition',inputView:'none',acceptedInputs:['day'],selectionContract:'none',completionContract:{afterSelection:'edit',continuationEntry:'edit'},revealView:'none',revealOpen:'result',closeDestination:'progress',cancellation:'discardInput'},
} as const satisfies Record<string,ActionAdapter>;
