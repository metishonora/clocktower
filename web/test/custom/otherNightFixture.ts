import type { FirstNightOrderPlan } from '../../src/custom/core/types.js';
// Independent fixture declaration; never used by production authoring or file loading.
export function otherOrderFor(ids: readonly string[]): FirstNightOrderPlan {
    const catalog: [
        string,
        string
    ][] = [['philosopher', 'chooseAbility'], ['poisoner', 'choosePoisonTarget'], ['snakeCharmer', 'choosePlayer'], ['monk', 'protectPlayer'], ['witch', 'chooseCursedPlayer'], ['cerenovus', 'assignMadness'], ['pitHag', 'changeCharacter'], ['imp', 'attackPlayer'], ['fangGu', 'attackPlayer'], ['noDashii', 'attackPlayer'], ['vortox', 'attackPlayer'], ['vigormortis', 'attackPlayer'], ['barber', 'swapCharacters'], ['empath', 'learnEvilNeighbors'], ['fortuneTeller', 'checkDemon'], ['undertaker', 'learnExecutedCharacter'], ['dreamer', 'learnCharacters'], ['flowergirl', 'learnDemonVoted'], ['townCrier', 'learnMinionNominated'], ['oracle', 'learnDeadEvilCount'], ['seamstress', 'compareAlignments'], ['juggler', 'learnJuggles'], ['butler', 'chooseMaster'], ['spy', 'inspectGrimoire'], ['mathematician', 'learnCount']];
    return [{ kind: 'system', actionId: 'dusk' }, ...catalog.filter(([c]) => ids.includes(c)).map(([characterId, actionId]) => ({ kind: 'character' as const, characterId, actionId })), { kind: 'system', actionId: 'dawn' }];
}
