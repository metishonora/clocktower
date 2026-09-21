# #248 Custom addresses and saved-game recovery

## Implemented behavior

- `/clocktower/custom/scenario/`: existing authoring and file review, with a saved-game entry.
- `/clocktower/custom/grimoire/`: existing session records ordered by durable save time.
- `?mode=setup`: transient setup; a cold entry explains the missing draft and shows saved games.
- `?game=<id>`: exact-game restoration independent of a browser history marker.
- First setup persistence must succeed before activating the game URL. Failure retains the previous slot and retries the accepted setup once.
- Returning to setup preserves the previous saved game; refresh then offers it in the list rather than silently resuming it.
- Old URLs never open replacement games in the same script slot. List/read/replay paths never write or advance the save timestamp.
- Legacy root markers resolve into exact-game addresses. Public reveals remain closed on restore.
- Back/forward observes the same save boundary as application navigation, including navigation waiting for the first durable activation.
- Both static custom entries share one NetworkFirst HTML cache key; game query parameters remain runtime input. A warm custom shell supports offline direct entry and refresh.

## Verification

Validation was run against real custom WASM and the built Vite output, using the lifecycle-managed issue preview server.

| Check | Result |
| --- | --- |
| `pnpm --dir web build` | Passed |
| `pnpm --dir web verify:pwa` | Passed, including both static entries and custom cache key |
| `node scripts/check-custom-boundaries.mjs` | Passed |
| `pnpm --dir web test:custom` | 56 files, 357 tests passed |
| `vitest run test/issue248CustomRoutes.test.tsx test/issue220T13NewScenario.test.tsx` | 14 tests passed |
| Browser and integration TypeScript checks | Passed |
| `cargo test -p clocktower-custom-domain -p clocktower-custom-wasm` | 258 domain and 6 WASM tests passed |
| `pnpm test:custom-runtime` | 109 fixture-domain and 13 fixture-WASM tests passed |

The focused browser selection covered 16 cases across `custom-saved-game-routes.spec.ts`, `custom-grimoire.spec.ts`, `issue222-other-nights.spec.ts`, and `production-smoke.spec.ts`:

- Direct recovery in a new tab without history state; subsequent save, reload and Undo.
- Old game URL after replacement, partial corrupt records, and a 390px saved-game list.
- Setup refresh with the preceding saved game intact.
- An injected IndexedDB first-write failure; setup URL and old record preserved, browser back blocked, retry activating one setup event, and subsequent reload.
- Legacy root navigation and the editor's manual recovery entry.
- Offline reload and direct navigation among game, list and editor addresses, including a previously unvisited query string sharing the HTML cache.
- Existing first-night setup, public reveal, reload and exact import/resume at 1366px.
- Existing daytime progression, reload and Undo.
- Existing new-game/import utilities and return-to-setup behavior at 1366px.
- Separate night orders and progression through the third night, including saved attack-result restoration and causal Undo at 1366px.
- The existing four official/custom production startup checks.

The old return-to-setup browser assertion expected refresh to resume the old game immediately. It was updated to the agreed #248 behavior: show the setup-not-saved notice and saved-game list, then explicitly resume the unchanged record. Its focused rerun passed; the other 15 cases passed in the initial selection. Desktop editor and mobile saved-list screenshots were visually inspected.

Application composition tests live in `web/test/`, alongside the existing grimoire application tests. Storage/replay tests stay in `web/test/custom/` so the isolated custom-runtime suite does not pull in the shared production UI tree.

## Source-menu review follow-up

The source screen now presents `새 시나리오를 쓴다`, `파일에서 불러온다`, and `저장된 게임을 이어간다` as peer choices with the existing typography, separators, and selected underline. The saved-game choice opens the list through `저장된 게임 보기`. Wide screens use three columns; screens up to 720px stack the choices.

- Production build, PWA verification and browser TypeScript checks passed.
- Existing source/review component tests (4) and New Scenario integration tests (7) passed.
- Browser checks covered the four production startup cases, legacy recovery through the new menu, authoring/file round-trip, and responsive authoring at 1366, 1180, 820 and 390px (10 cases). The round-trip test still expected the old version-2 export; its assertion was updated to the existing version-3 export with `nightOrderVersion: 2`, then passed on rerun. Product serialization was unchanged.
- The selected recovery menu was visually checked at desktop, 700px and 390px widths without horizontal overflow.

## Scope

No domain rules, canonical file schema, existing session keys or CI workflow scope changed. Editor drafts, pre-game setup and unconfirmed action input remain transient. The preview origin uses its own browser storage; production games can be reviewed by importing their game JSON there.
