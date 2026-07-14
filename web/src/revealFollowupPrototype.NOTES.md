# Reveal Follow-up Prototype Notes

Issue: #32

Question: How should a confirmed Reveal remain the current follow-up action while replay has already advanced to the next step?

Run: `pnpm prototype:reveal-followup`, then open `http://localhost:5173/?prototype=reveal-followup`.

Prototype decisions represented:

- Keep the Grimoire, event log, and setup controls visible.
- Replace only the current-step panel with the confirmed Reveal follow-up.
- Allow `플레이어에게 공개` and `다음 단계로 계속` immediately.
- Closing the player-facing Reveal returns to the same follow-up panel.
- Reopening and closing Reveal does not change the mocked event log.
- Hide the replay-derived next-step content and inputs until explicit continue.
- Continue clears only the pending Reveal presentation and exposes the already replayed next step.
- Reset, undo, new game, and import will clear a pending Reveal when the production state is implemented.

This prototype does not modify the game store, append events, persist Reveal UI state, or implement issue #32 production behavior.
