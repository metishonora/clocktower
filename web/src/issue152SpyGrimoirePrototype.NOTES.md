# Issue #152 Spy Grimoire Prototype Review Notes

This is a fixture-only review surface. It reuses production Trouble Brewing presentation components
and does not create a second runtime, persistence path, or token contract.

## Review states

- `?prototype=issue-152-spy-grimoire` opens the representative 10-player specimen on B, the
  existing live Grimoire/app shell.
- B is the approved production direction. A (`정적 reveal`) remains available only as a rejected
  comparison specimen for the static-seat alternative.
- The fixture control switches to a compact 5-player specimen and between the existing Trouble
  Brewing Night/Day themes.
- The representative specimen includes red-herring, poison, safe, master, no-ability, first-night
  information, died-today, Drunk identity, and Scarlet Woman succession reminder inputs. Dead seats
  remain visible, and the same character assets used by production are rendered on every seat.
- Fixture controls remain outside the production-like Grimoire. They are review-only and have no
  canonical game or storage behavior.

## Approved B behavior

- B reuses `TroubleBrewingLiveFlow` plus the existing `TroubleBrewingLiveGrimoire` without
  `revealMode`. The real `직업 / 마도서 / 진행` and `새 게임 / 저장·불러오기 / 버그 제보` controls
  remain visible, while seats open the existing read-only `PlayerTokenDetailDialog`.
- The existing live Grimoire center `진행 →` position is transformed into the sole visible
  `열람 종료` action. The bottom Spy exit rail is not used for B.
- While B is open, stage tabs, utility controls, home, Undo, and assignment-back are blocked. The
  annotation callback is omitted, so no edit or game mutation is introduced.
- Clicking center `열람 종료` shows the intended intermediate production screen `열람을 종료했습니다`
  with a `진행` button beneath it. The prototype's `진행` then ends at a clearly marked fixture-only
  handoff confirmation because canonical phase runtime is outside the prototype scope.
- There is no `다시 열람` action in the B production-like flow. The outer fixture controls can
  switch specimens for review, but reopening is not presented as a production action.

## Rejected A comparison

- A keeps the current production reveal treatment: static seat articles, no shell navigation, and
  no seat detail dialog. It retains its separate comparison-only exit treatment.
- A is retained solely to compare the rejected static-seat alternative against approved B; it does
  not change the production decision.

## Token presentation

The fixture and production TB adapter both consume canonical `RuleState.automaticReminders` and
render the official source character image in the same token presentation used by S&V. Manual
System/Script tokens remain separate and are labelled as manual presentation state.
