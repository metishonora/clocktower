# #209 approved inputs

`inputs.json` copies definition D from the #208 `drunk-empath-math` seed at
`e9518943e252d4a29037c2862ce6ed3e36f19a25` and transcribes R0–R11 in the order
specified in [Spec §7.1](https://github.com/metishonora/clocktower/issues/209#issuecomment-5592916694).
It contains inputs only; it is not generated from runtime output.

`web/test/custom/issue209Support.ts` gives seats deterministic `p1`… IDs, applies
only each case's explicit order/Shown variations, and selects the approved bluff
set: artist/savant/juggler, or soldier/mayor/virgin when the first set intersects
the roster. It never automatically confirms preparations or skips unexpected
steps. The test caller names each action and separately checks source where needed.

Fixed numeric and identity expectations live in the three `issue209*.test.ts`
files. Every successful action also runs export → parse → full replay → independent
IndexedDB save → new session load. Independent assertions and round-trip equality
serve different purposes; neither replaces the other.

Chef C13-b uses one explicit evil override for `[p1,p2]`; `[p2,p3]` uses actual good
alignment without an override. `registrationJudgments` encodes deviations from
actual identity, not a record of every normal identity observation.
