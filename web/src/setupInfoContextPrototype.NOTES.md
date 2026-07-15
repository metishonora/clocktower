# Setup Information Candidate Context Prototype Notes

Question: Where should Storyteller-only character context appear while selecting the two setup-information candidates?

Run: `pnpm prototype:setup-info-context`, then open `http://localhost:5173/?prototype=setup-info-context&variant=C`.

Variants:

- A - every candidate: every Player button shows Actual Character before selection.
- B - selected cards expand: only selected Player buttons show character context.
- C - separate comparison: candidate buttons stay compact and selected Players are compared below the grid.

Shared behavior:

- The Storyteller Grimoire shows Actual Character and Drunk Shown Character.
- A Drunk candidate is labeled with both `Actual: Drunk` and the Townsfolk character they believe they are.
- The shown-character select derives its options from the selected candidates' Actual Characters and the setup-information character kind.
- The safe Reveal contains only the two candidate labels and the delivered character. It does not receive or render Grimoire state, Actual Character, or Drunk Shown Character.
- Spy/Recluse Registration Judgments are intentionally absent because they are per-check discretionary state, not candidate Shown Character.

No final production direction has been selected yet.
