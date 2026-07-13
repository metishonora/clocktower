# Phase Control Prototype Notes

Question: Which clean phase-control layout should replace verbose rule-help UI for a rule-literate Storyteller?

Run: `pnpm prototype:phase-control`, then open `http://localhost:5173/?prototype=phase-control&variant=A`.

Shared decisions already made:

- Default screen includes phase action, acting Player, true information when false information may be shown, and Delivered Information.
- Rules explanation stays out of the default screen.
- Grimoire Peek is a temporary read-only overlay for full state checks.
- iPad default uses a right-side action panel. Mobile uses a bottom sheet.
- Do not show low-value fact rows such as input kind, character kind, or status as separate rows in the action panel.
- Delivered Information must be persisted for later Storyteller review/replay. This likely needs a separate implementation ticket because it changes command/proposal/event payload shape.
- Delivered Information choices appear only when the Storyteller is allowed to choose a displayed value, such as drunk/poisoned or a registration judgment. Otherwise the delivered value is fixed and no choice buttons are shown.
- Target selection is a Storyteller input, so it appears before computed or delivered information. Poisoner and Fortune Teller examples use target buttons above the result area.

Variants:

- A - map-first split: Grimoire remains dominant, action panel fixed on the right.
- B - action-first split: action panel dominates, context is secondary.
- C - order-first split: phase order rail drives the layout, Grimoire and action panel sit beside it.

Decision placeholder:

- Chosen direction: A - map-first split with right-side action panel.
- Pieces to keep: compact acting Player token, target buttons before result output, true information block, Delivered Information option buttons, Grimoire Peek.
- Pieces to reject: input/kind/status fact rows in the action panel, verbose rules explanation.
- Follow-up ticket needed: persist Delivered Information in Confirmed Events and replay/audit UI.
- Issue #25 comment URL:
