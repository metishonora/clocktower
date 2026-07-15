import { equal } from "node:assert/strict";
import test from "node:test";
import { isRevealPayload } from "./revealPayload.js";

test("RevealPayload rejects an unknown discriminant even when it resembles a text Reveal", () => {
  equal(isRevealPayload({ kind: "unknownReveal", messageKo: "표시하면 안 됨" }), false);
  equal(
    isRevealPayload({
      kind: "unknownReveal",
      players: [
        {
          playerId: "player-1",
          seat: 1,
          name: "Ada",
          characterId: "spy",
          alive: true,
          ghostVoteUsed: false,
          reminderTokens: [],
        },
      ],
    }),
    false,
  );
});
