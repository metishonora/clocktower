# Issue #13: PWA Offline and iPad Completion Plan

## Revised outcome

Ship the existing Trouble Brewing app as an installable static HTTPS PWA that remains usable offline
on iPad. Preserve the approved live-play composition: a Grimoire pane plus an action rail whose phase
overview appears above the current action. Do not restore the issue's obsolete literal three-pane
layout.

The approved official Toolmaker assets are part of the app shell: character icons and the Community
Created Content logo must be bundled locally, and the unofficial/noncommercial/personal-use notice
must remain visible without a network connection.

## Acceptance criteria

1. `pnpm --dir web build` emits a static GitHub Pages-compatible build under `/clocktower/`.
2. The manifest has standalone metadata, app scope/start URL, and opaque install icons suitable for
   iPad Home Screen use.
3. A generated Service Worker precaches the HTML, JavaScript, CSS, WASM, manifest, app icons, all 22
   Trouble Brewing character icons, and the CCC logo.
4. Reloading the installed shell offline does not require `release.botc.app` or any other remote asset
   host.
5. Production setup cards, Grimoire seats, and the current-actor surface use the approved official
   character icons.
6. The persistent CCC notice and policy link appear in setup and live play without obstructing primary
   controls.
7. Landscape keeps the approved Grimoire/action-rail layout; at 900px and below the existing stacked
   Grimoire and bottom action sheet remain usable without horizontal overflow.
8. Existing integration coverage continues to cover latest-game load, current-step confirmation,
   voting, and Reveal/return. A build smoke check additionally verifies the deployable PWA shell and
   its offline precache contract.
9. The GitHub Pages workflow builds and deploys `web/dist` whenever `main` is updated, while retaining
   a manual trigger for recovery and explicit redeployment. It does not change repository visibility or
   add authentication.

## Test-first seams

- TypeScript unit contract for the complete character-to-local-asset mapping.
- React production regression tests for setup, Grimoire/current actor, and CCC notice rendering.
- Post-build verifier for Pages base paths, manifest metadata/icons, Service Worker output, WASM, and
  offline official assets.
- Existing app integration suite for startup/load/current step/voting/Reveal behavior.

## Implementation notes

- Use Vite's configured base URL for every public asset path; never hardcode `/assets/...`.
- Use a generated precache manifest rather than a hand-maintained list of hashed build chunks.
- Keep IndexedDB latest-game storage unchanged; the Service Worker caches only the application shell
  and visual assets.
- Treat physical iPad installation/offline launch as a final manual acceptance check after automated
  browser and build validation.
