# Issue 27 Current Action Instructions Prototype

Run `pnpm --dir web prototype:issue-27-instructions`, then open
`/?prototype=issue-27-instructions`.

This prototype keeps the accepted issue #25 map-first layout and isolates the
copy/information decisions for issue #27. It does not alter the production phase
control.

Representative cases:

- Poisoner: actor and character context, ability summary, exact one-player prompt,
  and disabled confirmation until one target is selected.
- Chef: information-only action with an exact delivered-number prompt and disabled
  confirmation until a number is selected.
- Fortune Teller: exact two-player prompt.
- Execution result: show the affected Player and Character with one confirmation
  action. Do not ask the Storyteller to choose a rule-derived death outcome or add
  a generic instruction when no special effect applies.

Proposed production rule:

- Use character-specific operational wording when known.
- Fall back to wording generated from `RequiredInput` selection bounds.
- Reuse the existing `characters[].abilitySummary` text.
- Keep event summaries and layout ordering out of issue #27.
