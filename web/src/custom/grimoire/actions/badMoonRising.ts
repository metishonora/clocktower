import type {ActionAdapter} from './registry';
export const badMoonRisingActions = {
 'chambermaid.learnCount':{stage:'delivery',inputView:'information',acceptedInputs:['playerIds'],selectionContract:'information',completionContract:{afterSelection:'edit',continuationEntry:'select'},selectionLabel:'두 명 선택',revealView:'chambermaid',revealOpen:'preview',closeDestination:'progress',cancellation:'discardInput'},
} as const satisfies Record<string,ActionAdapter>;
