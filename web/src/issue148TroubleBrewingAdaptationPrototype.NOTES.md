# Issue #148 Trouble Brewing Shared-Shell Adaptation Decisions

This prototype approves Trouble Brewing presentation decisions for the script-neutral production
shell extracted in Issue #142. It is fixture-only and does not connect a second runtime, canonical
session, persistence path, or production route.

## Approved

- Keep the shared `직업 / 마도서 / 진행` workflow and separate `저장 / 불러오기` and `새 게임`
  utilities.
- Use the existing Trouble Brewing visual identity as the brand-token source: forest green and
  parchment are the primary Day/Night surfaces, muted gold marks selection and current focus, and
  rust marks evil or destructive emphasis. Day and Night retain explicit sun/moon and text signals.
  These are adapter-level brand tokens rather than shared-shell constants: S&V remains violet and a
  future BMR adapter can supply its own moonlit navy and oxblood palette without changing layout or
  semantic state colors.
- Match the production S&V shell chrome exactly: `새 게임 / 저장·불러오기 / 버그 제보` in that
  order, with global Undo immediately before the Day/Night mark. Prototype controls remain inert;
  runtime behavior belongs to the production integration.
- Review 5, 6, 7, and 15 Player specimens. Six Players is included because the production adapter
  must approve the full 5–6 Player composition, not just the five-Player endpoint.
- Pin Imp as the sole Demon. Present one effective distribution. When Baron is selected, use the
  concise `남작 · 외지인 +2 / 주민 -2` note without a second base-distribution table. The pinned Imp
  card and every selected read-only role remain available for role-summary review.
- Select Drunk as an Actual Outsider in Setup, then require its Shown Townsfolk in the Grimoire seat
  inspector. Show both identities to the Storyteller. The Shown Character does not reserve or consume
  an Actual Character slot, so the same Townsfolk may also exist in the Actual roster. Keep the editor
  to one `보여준 직업` selector and render the result as a small Character token in the upper-right
  corner inside the Drunk seat. The outside/inward badge position remains reserved for the shared
  `+N` attached-token count.
- Keep Player-name inputs accessible by seat-specific labels, but omit a redundant visible `이름`
  caption to match the shared S&V seat inspector.
- After confirmation, match the S&V Player-detail hierarchy: role identity, seat and Player name,
  alignment, close action, and Character ability. Omit the redundant alive status. For Drunk, show
  Actual and Shown identities as two explicit adjacent cards before the ability summary, and keep the
  primary Actual Drunk identity visually larger than its Shown Character token on the seat.
- Keep ordinary roles unique. `무작위 배치` only shuffles the approved roster among seats; it never
  generates a random roster.
- Use the shared rectangular perimeter, fixed-size seat tokens, role-first and seat-first assignment,
  Player names, reset, explicit confirmation, and mobile bottom-sheet contract.
- Keep confirmed Setup and Grimoire available as read-only review surfaces. The confirmed Grimoire
  may open Player details but cannot change canonical-looking fixture state.
- Use a seven-Player `1일차 밤 · 독살범 대상 선택` fixture to approve the first Play placement,
  current-actor highlight, dominant task, desktop/iPad order, and mobile drawer. For 5–6 Player
  fixtures, omit Minion and Demon information from the displayed first-night order.

## Rejected

- Keeping the Sects & Violets purple palette unchanged: it obscures script identity.
- Using one palette for every script: it would couple future BMR branding to S&V or TB presentation.
- Reviewing only 5, 7, and 15 Players: it leaves the six-Player composition unapproved.
- Choosing the Drunk Shown Character in the role catalog or counting it as another Actual role:
  the choice belongs to the assigned Player and must not distort the effective distribution.
- Overlaying the Shown Character on the large Actual-role icon in Player details: it obscures the
  Actual identity and makes the relationship ambiguous at small mobile sizes.
- Random roster generation: Issue #148 requires seat assignment only and the product remains a
  manual-roster Storyteller tool.
- Restoring free-position or legacy layout controls: the shared rectangular perimeter is the approved
  production direction.
- Prototyping every Trouble Brewing action or persistence behavior: Issue #113 owns canonical runtime
  wiring after this presentation is accepted.

## Presentation adapter contract for Issue #113

The production adapter supplies Player range, effective Rust-derived distribution, selected and
pinned roles, roster validity, seat projections, Actual/Shown identities, current actor, phase label,
task content, and phase-order content. Shared presentation components render those values and never
branch on Trouble Brewing Character IDs or infer setup legality.
