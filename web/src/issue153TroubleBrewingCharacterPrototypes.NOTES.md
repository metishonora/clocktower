# Issue 153 · Setup-information character prototypes

## Fixture map

The review route intentionally exposes one bounded fixture: `세탁부` in a
six-seat Trouble Brewing table. Seat 1 (`민지`) is the Washerwoman and seat 6
(`하린`) is the actual Soldier, so the reviewed result is truthful for either
candidate. The other seats only provide enough table context for the shared
live Grimoire.

The review path is:

1. `직업` — only one SnV-style Washerwoman actor identity is shown:
   `세탁부` / `1번 민지`. It is a `CharacterDetailButton` with TB-themed
   character details; the duplicate `선택한 직업` card is rejected. The
   handoff action is `좌석 선택` because the next task is choosing seats in
   the Grimoire.
   `마도서` and `진행` remain disabled.
2. `마도서` — the shared Trouble Brewing live Grimoire requires exactly two
   unselected seats. The native numbered summary and `선택 확정` control are
   used; the static fixture does not submit a runtime event.
3. `진행` — the same actor identity/detail affordance is reused. Candidates
   are shown as `대상` + `1번 민지 · 6번 하린`, separately
   from the `보여줄 캐릭터` selector. Choices are derived from the selected
   candidates' actual/registerable Townsfolk (세탁부 and 군인 in this fixture).
4. `정보 공개` — disabled until a character is chosen, then opens a centered
   minimal Reveal in this exact order: header `세탁부 정보`; square,
   side-by-side `후보 좌석` cards for `1번 민지` and `6번 하린`; prompt
   `둘 중 한 명은`; then the `공개 직업 군인` role group. Closing preserves
   the result, keeps a non-prominent `informationReveal` control for repeat
   review, and reveals `다음 단계`.
5. `세탁부 다음 단계` — a simple static completion region.

## Accepted decisions

- The prototype is Washerwoman-only for this review pass; the former
  character-by-character selector rail is not exposed.
- The shell uses the established Role → Grimoire → Progress hierarchy. Tabs
  unlock only after the preceding bounded fixture state is complete.
- The shared `TroubleBrewingLiveGrimoire` owns seat selection and its native
  two-target summary. No target is preselected.
- In a healthy setup-information flow, selecting two candidates is not enough
  to enable `선택 확정`: at least one candidate must have a truthful character
  of the required kind. This blocks Minion + Demon for both Washerwoman
  (Townsfolk required) and Librarian (Outsider required). An impaired setup
  information character is exempt because arbitrary information of the
  ability-shaped kind may be delivered.
- Both Role and Progress use the shared SnV interactive actor identity pattern
  and open the canonical TB character-detail sheet with `tb-day`/`tb-night`.
- Shared Grimoire selection panels and Progress actions receive their colors
  from semantic `--tb-ui-*` tokens at the `.tbProductionShell` theme boundary;
  individual prototype controls do not reintroduce SnV palette literals.
- The Progress card uses a compact green TB treatment. Candidate targets and
  the character selector are separate; no duplicate `진실` row is shown.
- `군인` is a valid resident choice because seat 6 is actually the Soldier.
  The chosen character is frozen after the first Reveal so reopening cannot
  silently change the delivered information.
- Reveal content is intentionally minimal and contains no Storyteller-only
  rationale, registration, or runtime/session state.
- After a healthy, unambiguous setup-information result is chosen, `마도서`
  opens the ordinary reference Grimoire instead of restarting candidate
  selection. The identified seat and the other candidate each receive a `+1`
  badge, and their player-detail dialogs expose the automatic official tokens
  `주민` and `오답` from the Washerwoman.
- No setup-information reminder is fabricated for poisoned arbitrary
  information or Librarian `외지인 없음`, because neither state identifies a
  canonical correct/wrong candidate pair.
- Reveal uses the established small gold section-header treatment. Candidate
  cards remain compact, square, and side-by-side at mobile widths; the card
  row is not collapsed into a vertical list.
- Theme and reset controls remain outside the production-like shell. The
  route uses `motion="none"` and adds no animation or transition.
- The Washerwoman route also exposes a fixture-only `세탁부 상태` control.
  In `중독`, any two seats can be confirmed and every Townsfolk is available
  in `보여줄 캐릭터`; the selected false information uses the same approved
  Reveal format and remains repeatable.
- Both character routes reuse the production SnV impairment badge in the
  Progress identity. Selecting `중독` therefore shows the explicit `중독`
  badge next to the character name instead of relying on review controls alone.

## Librarian review route

The Librarian is kept on the separate `issue-153-tb-librarian` review route;
the accepted Washerwoman route remains unchanged and neither screen exposes a
character selector.

- Seat 1 (`민지`) is the Librarian and seat 6 (`하린`) is the actual Saint.
  The healthy path therefore offers `성자` after those two candidates are
  chosen and uses the same approved candidate-card Reveal order.
- A fixture-only `사서 상태` control sits outside the production shell. In
  `정상`, the `외지인 없음` choice is not rendered at all. In `중독`, all
  Outsider characters and `외지인 없음` are available, matching the engine's
  impaired-information rules.
- The SnV impairment convention is shared by both prototypes: every poisoned
  character shows the `중독` badge before target selection and again in the
  progress task, and the action is labelled `중독 정보 공개`.
- `외지인 구성` adds the real healthy zero-Outsider fixture. It replaces seat
  6's Saint with a Soldier and moves straight to Progress without an
  intermediate action. Progress renders fixed `대상 / 외지인 없음`
  information with an immediately available Reveal action and no character
  selector.
- Selecting `외지인 없음` clears the two candidate seats. Its Reveal retains
  the `사서 정보` header and the sole body copy `외지인이 없습니다`; no icon,
  explanation, or stale candidate cards are shown.
- A healthy candidate result exposes the official automatic `외지인` and
  `오답` tokens through the reference Grimoire player-detail dialogs.

## Investigator review route

The Investigator uses the separate `issue-153-tb-investigator` route and the
same approved two-candidate setup-information flow.

- A healthy selection can be confirmed only when one of the two chosen seats
  is an actual Minion. The progress selector then offers only the truthful
  Minion character represented by the chosen pair.
- A poisoned Investigator can confirm any two seats and choose any Minion,
  while retaining the shared pre-selection/progress `중독` badges and
  `중독 정보 공개` action.
- Reveal keeps the approved order: `수사관 정보`, two candidate seat cards,
  `둘 중 한 명은`, then the selected Minion icon and name.
- A healthy candidate result exposes the official automatic `하수인` and
  `오답` tokens through the reference Grimoire player-detail dialogs.

## Chef review route

The Chef uses the separate `issue-153-tb-chef` route and skips the Grimoire
because no player target is required.

- The healthy Progress task follows the SnV scalar-information pattern, opens
  immediately, and shows only `진실 / 1쌍` before the Reveal action.
- A poisoned Chef keeps the truth row for the Storyteller and adds a separate
  free-form non-negative integer input, initially `0쌍`, along with the shared
  poison badge and `중독 정보 공개` action.
- Reveal shows `요리사 정보`, the Chef identity, `서로 이웃한 악한 팀`, and
  the delivered `N쌍` value.

## Empath review route

The Empath uses the separate `issue-153-tb-empath` route and shares the
approved scalar-information flow with the Chef.

- The healthy Progress task opens immediately and shows `진실 / 1명` with no
  Grimoire or intermediate confirmation action.
- A poisoned Empath retains that truth row and can enter any non-negative
  integer to deliver, starting at `0명`.
- Reveal shows `초공감자 정보`, the Empath icon, `살아있는 양옆 이웃 중 악한 팀`,
  and the delivered `N명` value without a duplicate character-name caption.

## Fortune Teller review route

The Fortune Teller uses the separate `issue-153-tb-fortune-teller` route and
keeps its two first-night actions in canonical order.

- Progress first sends the Storyteller to the Grimoire to assign one eligible
  good player as `착각 대상`; no separate `준비` summary is shown, and the
  chosen seat uses a cyan selection accent distinct from the gold actor state.
- Confirming the `착각 대상` stays in the Grimoire and immediately switches the
  selection panel to exactly two Fortune Teller information targets.
- The assigned seat does not show a Fortune Teller icon. After information
  targets are confirmed, the ordinary `마도서` tab opens a reference Grimoire;
  its token-count badge and player detail dialog expose the official automatic
  `착각 대상` token without restarting target selection.
- Healthy information shows the selected pair and fixed `결과 / 있음·없음`.
- A poisoned Fortune Teller retains the truth while offering either result as
  `전달할 정보` and uses the shared poisoned Reveal action.
- Reveal shows `점쟁이 정보`, the icon, `이 중에 악마는…`, the two compact
  seat cards, and the delivered `있음` or `없음` result.

## Undertaker review route

The Undertaker uses the separate `issue-153-tb-undertaker` route and starts on
the later-night Progress task because the execution result already determines
the target; there is no Storyteller target-selection handoff.

- The bounded fixture is `2일차 밤`: seat 4 (`지우`) is a Mayor who died by
  execution. Progress immediately shows `대상 / 4번 지우` and
  `진실 / 시장`, with the Reveal action ready.
- The ordinary reference Grimoire remains available. Seat 4 carries a `+1`
  badge, and its player-detail dialog exposes the automatic official
  `오늘 사망` token sourced from the Undertaker.
- A poisoned Undertaker retains `진실 / 시장` for the Storyteller and selects
  any Trouble Brewing character under `전달할 캐릭터`; the action uses the
  shared poison badge and `중독 정보 공개` treatment.
- Reveal keeps the approved targeted-information order: `장의사 정보`, the
  single square executed-player card, `이 자의 직업은…`, then the delivered
  character icon and name.

## Monk review route

The Monk uses the separate `issue-153-tb-monk` route and follows the established
S&V-style targeted-action handoff without an information Reveal.

- The `2일차 밤` Progress task shows the Monk actor, ability, impairment badge,
  and a single `대상 선택` action.
- The Grimoire disables the Monk's own seat, labels the selected seat `보호`,
  and confirms exactly one eligible target inside the work panel.
- Confirming the target advances directly to the next step. The ordinary
  reference Grimoire exposes the automatic official `안전` token sourced from
  the Monk on the protected player.
- A poisoned Monk still performs the apparent target-selection flow and keeps
  the shared poison badge. The selected player retains an `안전` reminder with
  the shared X-marked `현재 효력 없음` treatment, while no active protection
  state is created.

## Ravenkeeper review route

The Ravenkeeper uses the separate `issue-153-tb-ravenkeeper` route and starts
on a `2일차 밤` death-triggered Progress task.

- The Ravenkeeper is already dead when the task begins. `대상 선택` opens the
  Grimoire work panel, where any living or dead player—including the
  Ravenkeeper—remains eligible.
- Confirming one player returns to Progress and immediately shows the selected
  target plus the Storyteller-only truthful character. The ordinary `마도서`
  tab opens a reference Grimoire instead of restarting target selection.
- Healthy information can be revealed immediately. A poisoned Ravenkeeper
  keeps the truth visible, selects any Trouble Brewing character under
  `전달할 캐릭터`, and uses the shared poison badge and action treatment.
- Reveal follows the approved single-target order: `까마귀지기 정보`, one
  compact square seat card, `이 자의 직업은…`, then the delivered character
  icon and name.

## Virgin review route

The Virgin uses the separate `issue-153-tb-virgin` route and has no dedicated
Progress task. Its passive ability interrupts the ordinary daytime nomination
flow only when it actually fires.

- The route opens directly in the production Trouble Brewing nomination
  Grimoire. The canonical path selects seat 3's Townsfolk as nominator and
  seat 1's Virgin as nominee.
- Confirming that healthy first nomination immediately opens a single public
  Reveal: `성결자 능력` / the nominator / `즉시 처형됩니다`.
- Closing the Reveal records the nominator's execution and immediately ends
  the day, because any execution ends the daytime phase. There is no vote for
  that nomination and no separate Virgin confirmation or death card.
- A poisoned first trigger still spends the Virgin ability but skips the
  Reveal and begins vote collection immediately; the Virgin's poison remains
  visible through the standard Grimoire token state.
- Once spent, the ordinary reference Grimoire exposes the official automatic
  `능력 없음` token on the Virgin. The token is not X-marked because it records
  a real, persistent ability-use state rather than an ineffective temporary
  effect.

## Slayer review route

The Slayer uses the separate `issue-153-tb-slayer` route and adopts the SnV
daytime free-action dock instead of adding a dedicated Progress task or a
seat-level action control.

- The route opens on the ordinary `1일차 낮` Grimoire. The floating official
  Slayer icon opens a compact `처단자 능력 사용` panel with the actor identity,
  ability text, and all player targets.
- Selecting the Recluse also exposes the explicit Storyteller judgment using
  the shared `취급` terminology (`악마로 취급하지 않음` / `악마로 취급`).
- `처단자 능력 사용` immediately opens a public ability Reveal. A healthy
  Demon hit reports that the selected player died; closing the Reveal applies
  the death directly to the Grimoire without a redundant death-confirmation
  step.
- A miss or poisoned action leaves the target alive and reveals the fixed
  two-line result `아무런 일도` / `일어나지 않음`; poison is visible in the
  free-action header and uses the shared poison-colored confirmation action.
- Every confirmed use removes the available free action and exposes the
  official automatic `능력 없음` token on the Slayer. Poison remains a separate
  automatic token when applicable.

## Soldier review route

The Soldier uses the separate `issue-153-tb-soldier` route and has no dedicated
character action. Its passive ability is reviewed inside the ordinary later-night
Imp attack flow.

- Progress starts on the Imp actor and sends the Storyteller to the Grimoire
  for one attack target. The shared attack highlight and `임프 능력` work panel
  are unchanged.
- Confirming the attack stays on the Grimoire and changes the shared selection
  panel to `악마 공격 결과`, matching the SnV completed-handoff pattern. Its
  `다음 →` action returns to Progress; there is no Soldier-owned result card.
- A healthy Soldier is shown as the living attack target. A poisoned Soldier is
  shown as the dead attack target while retaining the poison token, and the same
  confirmed attack records that player among the unannounced night deaths.
- No player-facing Reveal, Soldier-owned target selection, or explicit Soldier
  resolution step is added.

## Mayor review route

The Mayor uses the separate `issue-153-tb-mayor` route and, like the Soldier,
is reviewed inside the ordinary later-night Imp attack flow rather than through
a dedicated character step.

- Selecting a healthy Mayor exposes only the two required `시장 공격 결과`
  choices in the Grimoire work panel: `시장이 사망` or
  `다른 플레이어가 대신 사망`.
- Choosing replacement death opens a second Grimoire target-selection state
  instead of listing every player as a panel button. The attacked Mayor keeps
  the red attack highlight while the replacement target uses a distinct green
  highlight, so the interaction scales to the 15-player layout.
- Confirming a bounced attack stays on the Grimoire. The completed panel keeps
  the Mayor alive, shows the replacement player as dead, and returns to
  Progress only through `다음 →`.
- A poisoned Mayor does not expose the Mayor decision. The same attack target
  can be confirmed immediately and dies as an ordinary poisoned target while
  the standard poison token remains visible.
- This focused surface covers the night-death replacement. The separate
  three-living-players and no-execution win condition belongs to the daytime
  phase-end/game-end review rather than this attack interaction.

## Butler review route

The Butler uses the separate `issue-153-tb-butler` route and follows the
shared S&V-style targeted-action handoff without an information Reveal.

- The `2일차 밤` Progress task shows the Butler actor and sends the Storyteller
  to the Grimoire with `대상 선택`.
- The Butler's own seat is disabled during the night action. Selecting exactly
  one other player labels that seat `주인`; confirming proceeds to a fixture
  of the following daytime vote.
- The ordinary reference Grimoire exposes the official automatic `주인` token
  sourced from the Butler on the selected player.
- Vote-seat selection is order-independent. The Butler can be selected before
  or after the master because only the final submitted voter set matters.
- On confirmation, a healthy Butler vote without the master's vote is
  automatically removed from the effective count. The completed Grimoire
  panel reports the effective total and `무효 · 주인 미투표`; the draft is not
  blocked merely because the master was selected later or not at all.
- A poisoned Butler still records whom they selected. The standard poison badge
  remains visible, the voting restriction is inactive, the Butler's vote stays
  effective without the master, and the selected player's `주인` token uses
  the shared X-marked `현재 효력 없음` treatment.
- This prototype covers one nightly selection. Replacing the prior night's
  master belongs to production event/state integration rather than this fixture.

## Drunk review route

The Drunk uses the separate `issue-153-tb-drunk` route and follows the approved
S&V Philosopher identity hierarchy while preserving the Drunk's distinct setup
semantics.

- Setup assigns the actual `주정뱅이` and separately chooses one Townsfolk
  under `보여준 직업`. The shown character may match another player's real
  character; actual and shown identities remain separate data.
- Progress keeps the large acting identity as `주정뱅이 · 1번 민지`. A nested
  `보여준 직업` card presents the chosen character, its ability text, and the
  `취함` state, matching the Philosopher's owner/acting-ability hierarchy.
- The ordinary reference Grimoire keeps the player-facing shown character on
  the seat while the Storyteller-only player detail exposes `실제 직업`,
  `보여준 직업`. No redundant `주정뱅이임` reminder token is added because
  the actual identity already carries that information.
- Production should schedule and render the shown character's approved action
  flow with the Drunk as ability owner and permanent `취함` context. This
  focused prototype reviews that identity boundary rather than duplicating all
  Townsfolk action variants inside the setup fixture.

## Recluse review route

The Recluse uses the separate `issue-153-tb-recluse` route but deliberately
does not receive a character-owned Progress step. Its ability is resolved only
inside the other character action that is currently judging the Recluse.

- In the Fortune Teller case, target selection and the healthy Recluse's
  `악마로 취급하지 않음` / `악마로 취급` judgment live in the same Grimoire
  selection panel. `선택 확정` commits both together; Progress only presents
  the resulting `없음` / `있음` information and its Reveal.
- The review-only `판정 사례` control also exposes an Empath case. Because the
  Empath has no Grimoire input, its healthy Recluse judgment appears directly
  on the Progress information card before the truth row.
- A poisoned Recluse removes the special-treatment choice. The acting
  character's information surface does not expose the Recluse's impairment;
  it only presents the canonical result for the fixture (`없음` for Fortune
  Teller, `0명` for Empath).
- Other abilities should use the same point-of-judgment pattern with precise
  labels for what they test (`악한 팀`, `하수인`, `악마`, or a specific evil
  character). No persistent registration state or Recluse reminder token is
  created.

## Saint review route

The Saint uses the separate `issue-153-tb-saint` route and has no
character-owned action. Its passive ability is evaluated only when the
ordinary daytime execution is committed.

- The fixture uses the production-like nomination and vote Grimoire. After a
  qualifying vote, the result panel freezes the tally and exposes one
  `낮 종료 및 처형` action; it does not invent a Saint-specific Progress step.
- Executing a healthy Saint immediately opens the shared game-end dialog for
  `악 진영 승리`. Confirming it leaves the standard game-end status visible.
- Executing a poisoned Saint still records the death and ends the day, but it
  skips the win dialog and continues to the next night because the Saint's
  ability is ineffective.
- Ordinary Grimoire inspection remains available after either result so the
  Storyteller can verify the Saint's death and, in the poisoned fixture, the
  existing poison state.
- The Saint has no standalone UI to approve. Final acceptance is deferred to
  an end-to-end production test of the real nomination, vote, execution, and
  game-end pipeline.

## Poisoner review route

The Poisoner uses the separate `issue-153-tb-poisoner` route and follows the
shared targeted-night-action flow.

- Progress shows the acting Poisoner and sends `대상 선택` to the Grimoire.
  Every seat, including the Poisoner, is selectable.
- The selected seat uses the dedicated poison target state. Confirming it
  keeps the Storyteller in the Grimoire with a frozen `중독 적용 결과` panel,
  so the applied status can be checked before continuing.
- A healthy Poisoner applies the official automatic `중독` token and the
  active poison state. The ordinary reference Grimoire exposes that token in
  the player-detail dialog.
- If the Poisoner is already poisoned, the target choice is still recorded but
  does not apply an active poison state. Its reminder token remains visible
  with the standard X treatment and an explicit ineffective reason.

## Spy review route

The Spy uses the separate `issue-153-tb-spy` route and reuses the approved
Issue #152 locked live-Grimoire presentation.

- Progress presents one `마도서 공개` action. Opening it replaces the
  Storyteller task with the ordinary Trouble Brewing live Grimoire, locks all
  shell navigation and game actions, preserves player-detail inspection, and
  closes through `확인 완료` in the Grimoire center.
- Closing the reveal returns to the same Progress task with `마도서 다시 공개`
  and `다음 단계`, so the Storyteller can repeat the handoff before continuing.
- The ordinary `마도서` tab always remains a Storyteller-only view of the
  actual state. A poisoned Spy instead receives a separately prepared false
  fixture through `중독 마도서 공개`; the sample swaps two character
  identities and moves status information so truth and delivery are visibly
  distinct without exposing that distinction inside the player handoff.
- The poisoned fixture settles the delivery boundary only. Production still
  needs a dedicated way to prepare the arbitrary false Grimoire; this route
  does not pretend that a full editor already exists.

## Scarlet Woman review route

The Scarlet Woman (`탕녀`) uses the separate
`issue-153-tb-scarlet-woman` route with two concrete Imp-death fixtures.

- `투표로 처형` starts on the real vote handoff with the Imp already nominated.
  After the vote is confirmed, `낮 종료 및 처형` kills the Imp and applies the
  succession in the same resolution. The result remains visible in the
  Grimoire before the Storyteller begins the night.
- `임프가 자신을 공격` starts on the real Imp target handoff and restricts
  this review fixture to the Imp's own seat. Confirming the self-attack kills
  the Imp and applies Scarlet Woman succession immediately. The new Imp is
  informed during that same night and does not act again until their next
  scheduled Imp action.
- With five players alive immediately before either death and a healthy Scarlet
  Woman, succession is automatic. No Scarlet-Woman-owned Progress phase or
  `승계 확정` action is created.
- The existing Grimoire result immediately shows the former Imp dead, the
  Scarlet Woman's actual identity replaced by Imp, and the official `악마임`
  automatic reminder. Its frozen result panel names the triggering death and
  lets the Storyteller verify the automatic consequence before continuing.
- Before play continues, Progress presents the character-change handoff. Its
  player-facing surface follows the approved SnV
  full-screen character-change hierarchy: `당신의 직업이 변경되었습니다`,
  large Imp icon/name, evil alignment, and the standard eyes-closed action.
- If fewer than five players were alive immediately before the Imp death, or
  if the Scarlet Woman was poisoned at that moment, no succession task is
  invented. The standard good-team `demonAbsent` game-end dialog appears
  instead. The review controls expose both cases.

## Rejected / deferred decisions

- No character after the Scarlet Woman is included in these focused review surfaces;
  those fixtures belong to later review passes.
- No canonical event submission, session/store mutation, WASM call, or fake
  night resolution is implemented.
- No additional candidate/result variants, registration choices, or
  Storyteller scheduling policy are invented for this pass.
- Korean terminology decisions outside this flow (`속임수/블러프`,
  `역할/직업`) remain deferred to the broader script review.
