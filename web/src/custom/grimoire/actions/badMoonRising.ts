import type {ActionAdapter} from './registry';
import {directNightAction,nightInformation} from './nightContracts';
export const badMoonRisingActions = {
 'grandmother.learnGrandchild':{...nightInformation,acceptedInputs:['playerIds'],selectionContract:'information',completionContract:{afterSelection:'edit',continuationEntry:'select'},selectionLabel:'손주 지정',revealView:'tb'},
 'gambler.guessCharacter':{...directNightAction,acceptedInputs:['characterTransformation'],selectionLabel:'사람·직업 선택',confirmSelectionLabel:'추측 확정',resultReview:'selection'},
 'devilsAdvocate.protectExecution':{...directNightAction,selectionLabel:'보호 대상 선택',resultReview:'selection'},
 'assassin.killPlayer':{...directNightAction,selectionLabel:'암살 대상 선택',confirmSelectionLabel:'공격 확정',resultReview:'selection'},
 'moonchild.resolveDeath':{...nightInformation,stage:'action',inputView:'none',revealView:'none',revealOpen:'result'},
 'chambermaid.learnCount':{stage:'delivery',inputView:'information',acceptedInputs:['playerIds'],selectionContract:'information',completionContract:{afterSelection:'edit',continuationEntry:'select'},selectionLabel:'두 명 선택',revealView:'chambermaid',revealOpen:'preview',closeDestination:'progress',cancellation:'discardInput'},
} as const satisfies Record<string,ActionAdapter>;
