# Issue 120 Event Log prototype

Run `pnpm prototype:issue-120-event-log`, then open:

`http://<tailscale-ip>:5173/clocktower/sects-and-violets/?prototype=issue-120-event-log`

Review targets:

- The red global Undo icon remains directly before the Day/Night phase mark on every page.
- Setup-only hides generic Undo; transition work leaves an eligible Undo visible but disabled.
- Undo opens a safe confirmation that identifies the latest completed checkpoint. The mock latest
  checkpoint owns two Confirmed Events so the grouped-removal contract is visible after confirmation.
- Storage/Load shows a permanently open, internally scrollable Event Log with newest events first.
- The Event Log contains no separate latest-event or Undo panel and only reports its event count.
- Severe import/replay failure uses a modal and states that the current game is preserved.
- Core warnings use a persistent dismissible bottom notification instead of Event Log allocation.
- Use the review controls to compare Day/Night themes and the normal, setup-only, busy, error, and
  warning states.
