import type {ActionAdapter} from './registry';
export const carouselActions = {
  'marionette.assignShownCharacter':{stage:'preparation',inputView:'ability',acceptedInputs:['characterIds'],selectionContract:'none',completionContract:{afterSelection:'edit',continuationEntry:'edit'},revealView:'none',revealOpen:'notification',closeDestination:'progress',cancellation:'discardInput'},
  'boffin.grantAbility':{stage:'preparation',inputView:'ability',acceptedInputs:['characterTransformation'],selectionContract:'none',completionContract:{afterSelection:'edit',continuationEntry:'edit'},revealView:'none',revealOpen:'notification',closeDestination:'progress',cancellation:'discardInput'},
  'balloonist.learnPlayer':{stage:'delivery',inputView:'information',acceptedInputs:['playerIds'],selectionContract:'information',completionContract:{afterSelection:'edit',continuationEntry:'select'},selectionLabel:'알려줄 플레이어 선택',revealView:'learnedPlayer',revealOpen:'preview',closeDestination:'progress',cancellation:'discardInput'},
  'pixie.learnTownsfolk':{stage:'delivery',inputView:'information',acceptedInputs:['playerIds'],selectionContract:'information',completionContract:{afterSelection:'edit',continuationEntry:'select'},selectionLabel:'집착 대상 선택',revealView:'learnedCharacter',revealOpen:'preview',closeDestination:'progress',cancellation:'discardInput'},
  'pixie.assessMadness':{stage:'action',inputView:'execution',acceptedInputs:['executionDecision'],selectionContract:'none',completionContract:{afterSelection:'edit',continuationEntry:'edit'},revealView:'none',revealOpen:'result',closeDestination:'progress',cancellation:'discardInput'},
  'nightwatchman.choosePlayer': {
    stage:'action', inputView:'information', acceptedInputs:['playerIds'],
    selectionContract:'information', completionContract:{afterSelection:'edit',continuationEntry:'select'},
    selectionLabel:'통지할 대상 선택', revealView:'none', revealOpen:'notification',
    closeDestination:'progress', cancellation:'discardInput',
  },
} as const satisfies Record<string,ActionAdapter>;
