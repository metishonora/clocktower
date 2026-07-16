# Day Voting Prototype Notes

Issues: #33 baseline, #9 execution/Death and ghost-vote rework

Run `pnpm prototype:day-voting`, then open:

`http://localhost:5173/?prototype=day-voting`

## Decisions represented

- Day remains the top-level phase and is split into Death Announcement, Whisper, Discussion,
  Nomination/Voting, and Execution steps.
- The large execution-candidate standing uses confirmed replay state only.
- Draft voter selection changes current vote count and pending ghost-vote display, but does not
  change the confirmed candidate standing before confirmation.
- A unique top result below the threshold and a tied top result both display
  `후보 없음 — n표`.
- The standing shows operational context as `기준 4표 · 생존자 8명` without explanatory prose.
- Whisper and Discussion have explicit forward actions and no timer or auxiliary input.
- Confirmed seats always expose `생존`, `사망 · 유령표 남음`, or
  `사망 · 유령표 사용됨`.
- An unspent dead Player remains selectable during voting while a spent ghost voter is visibly
  unavailable.
- Execution confirmation is followed by a separate Death confirmation state.
- Trouble Brewing shows `사망하지 않음` as a dimmed disabled action while `사망 확정` remains
  enabled.
- The post-Death state updates the executed Player's seat before the Night transition.

## Scenario controls

The header switches the confirmed replay example among:

- no confirmed votes;
- a unique leader below threshold;
- a unique qualifying candidate;
- a tie at the highest qualifying vote count;
- a lower tie that does not displace a higher unique candidate.

The phase overview and forward buttons demonstrate the proposed day workflow. The prototype is
development-only and does not call Rust, create Commands, append Confirmed Events, or change
production state.
