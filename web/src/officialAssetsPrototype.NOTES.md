# Official Toolmaker Assets Prototype Decision

Approved by the product owner on 2026-07-18 for issue #13.

## Approved direction

- Use the official Trouble Brewing character icons on Grimoire seats, character-selection controls,
  and the current-actor surface.
- Keep the compact iPad live-play composition demonstrated by the prototype: Grimoire on the left and
  the active setup/live-play rail on the right, with a stacked responsive layout on narrow screens.
- Display the Community Created Content logo with a persistent Korean notice that the tool is
  unofficial, noncommercial, and for personal use, plus a link to the community content policy.

## Production constraint

The initial prototype used `release.botc.app` for visual confirmation. The approved implementation now
bundles the icons and CCC logo locally and includes them in the offline app shell; neither the
prototype nor production requires those remote URLs during live play.

This decision confirms the asset treatment and notice presentation only. It does not replace the
remaining issue #13 work for static hosting, iPad installation, offline caching, responsive production
validation, accessibility verification, and browser smoke coverage.
