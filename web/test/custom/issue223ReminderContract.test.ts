import { describe, expect, it } from 'vitest';
import { isRevealPayload } from '../../src/custom/core/revealPayload.js';

const payload = (characterId: string, tokenId: string) => ({
  kind: 'spyGrimoire', players: [{ playerId: 'p1', seat: 1, name: 'P1', characterId: 'soldier',
    alignment: 'good', alive: true, ghostVoteUsed: false,
    automaticReminders: [{ playerId: 'p1', characterId, tokenId, label: '표시', description: '상태' }],
  }],
});
describe('character reminder public snapshot contract', () => {
  it.each([
    ['flowergirl', 'demonVoted'], ['flowergirl', 'demonDidNotVote'],
    ['townCrier', 'minionNominated'], ['townCrier', 'minionDidNotNominate'],
    ['scarletWoman', 'isTheDemon'], ['philosopher', 'isThePhilosopher'],
    ['artist', 'noAbility'], ['juggler', 'correct'], ['barber', 'haircutsTonight'],
    ['mathematician', 'abnormal'], ['sweetheart', 'drunk'], ['vigormortis', 'poisoned'],
  ])('accepts %s:%s in Spy reveal', (character, token) => {
    expect(isRevealPayload(payload(character, token))).toBe(true);
  });
  it('rejects a token attached to the wrong character', () => {
    expect(isRevealPayload(payload('flowergirl', 'minionNominated'))).toBe(false);
  });
});
