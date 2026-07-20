# Issue #90 Spy Reveal prototype

This production-shaped prototype validates one direction only:

- keep the current Grimoire board, seat geometry, tokens, compact behavior, colors, and typography;
- replace the Storyteller control panel with the single close action during Spy Reveal;
- render Reveal seats as non-interactive articles rather than hidden or disabled buttons;
- pass the reused board a sanitized Player-shaped projection with shown character, manual tokens,
  and notes removed before render;
- remove current phase/runtime, event log, shown character, manual tokens, notes, and character controls from the Reveal DOM;
- keep active poisoned/protected state and life/ghost-vote state visible;
- compare the same 5, 10, or 15-player state across all presets and one manually adjusted layout.

The full-screen experience removes the prototype review controls as well, so the close action is the
only rendered button. This prototype does not yet connect the new mode to the production Spy Reveal
lifecycle or change the narrow payload contract.
