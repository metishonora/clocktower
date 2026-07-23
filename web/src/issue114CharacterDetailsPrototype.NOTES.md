# Issue 114 character-detail prototype

Development route:

`/clocktower/trouble-brewing/?prototype=issue-114-character-details`

This review specimen fixes the approved presentation contract before production extraction:

- the role selection, Grimoire Player detail, and current phase actor open the same character data;
- the character icon and name form the trigger, with no separate info or detail icon;
- desktop and iPad use a right drawer while narrow mobile uses a bottom sheet;
- the ordered content is official ability, rulings, How to Run, reminders, collapsed examples, and
  official source;
- static automation-support copy and developer-only example metadata are absent;
- opening character details from a Player detail leaves the Player detail underneath and restores
  focus to the character identity when closed;
- the Player detail owns currently attached tokens, while the character drawer owns the official
  reminder inventory.

The specimen consumes the Sects & Violets rules data directly for review. Production work after UI
approval should extract a shared presentation contract with script-specific Trouble Brewing and
Sects & Violets adapters, then replace the existing script-specific detail implementations.
