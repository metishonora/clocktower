# CI scope

Default validation and Pages deployment check the production build, PWA assets,
and four browser startup smoke tests. They do not certify gameplay correctness
or UI parity. Smoke tests use the built site and real WASM, not prototype routes
or mocked runtimes. The preview server is owned and stopped by Playwright.

Run the same checks locally:

```sh
pnpm --dir web build
pnpm --dir web verify:pwa
pnpm --dir web exec playwright install chromium
pnpm --dir web test:smoke:run
```

Existing regression suites remain available for relevant changes; they are not
run on every push:

- `cargo test --workspace`
- `pnpm test:web`
- `pnpm build:wasm:custom && pnpm --dir web test:custom`
- `pnpm test:custom-runtime`
- `node scripts/check-custom-boundaries.mjs`
- `node --test scripts/check-custom-boundaries.test.mjs`
- `node scripts/verify-custom-runtime-isolation.mjs`
- `pnpm test:test-server`
- `pnpm test:browser` (full browser suite, including a fresh build)

CI intentionally no longer catches all regressions omitted by local validation.
