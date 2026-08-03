# Issue 108: Mathematician abnormal-ability accounting

## Confirmed behavior

- Count players, not resolution events. Deduplicate by `subjectPlayerId` inside one accounting window.
- First night starts after setup confirmation. Later nights start after the preceding dawn transition and include that day plus the current night before Mathematician resolves.
- An impairment state is not itself abnormal. Record only a delivered result or concrete effect that falls outside the healthy ability's permitted outcomes.
- Preserve every contributing resolution as audit evidence, including character, ability instance, resolution event, cause, phase, and step.
- Exclude Mathematician's own delivery from its truthful count. Apply the common Delivered Information contract only after the truthful projection is complete.

## Approved production UI

- Show the truthful number first.
- Keep `계산 근거` collapsed by default and show one row per counted player.
- The expanded Storyteller audit shows player, character, concrete outcome, cause, and timing.
- The player-facing reveal shows only the delivered number.
- Impaired and Vortox numeric input may be cleared while editing. Do not show persistent range or accounting helper copy; show validation only when actionable.

## Implementation

1. Build a source-agnostic replay projection from typed S&V resolution events.
2. Preserve all evidence while projecting one record per subject player for the active window.
3. Expose the projection only on the current Mathematician information prompt and use its record count as the computed truth.
4. Confirm the step through the existing numeric Delivered Information path, including Vortox's non-negative safe-integer constraint and truthful-value exclusion.
5. Render the approved audit disclosure in the production information task and keep Reveal payloads audit-free.

## Verification

- Official examples 1–3 and representative healthy/impaired/Vortox paths.
- Window boundaries and player deduplication.
- Witch nomination timing and persistent No Dashii, Vigormortis, and Vortox failures.
- Replay, import, undo, and player-safe Reveal behavior.
- `cargo test --workspace`, `pnpm --dir web test`, and `pnpm --dir web build`.
