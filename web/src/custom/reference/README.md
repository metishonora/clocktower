# Scenario reference

`scenario_jinxes` projects the existing Rust Jinx registry by the entire scenario pool. Korean copy in `crates/custom-domain/resources/jinxes.ko.json` is localization keyed by registered Jinx ID, not a second pair registry. A missing translation is an error. The source character opens the same wiki URL as its character detail. No event, player or live-effect data enters this query or the PDF input.

The role screen and authoring review use the same query hook. Responses are bound to the pool key, so an older response cannot enable a newer document. Empty results hide the Jinx section; failures expose retry and keep the document action disabled.

The lazily loaded PDF generator runs in a worker. PDF.js paints its exact bytes on white canvases. The print/save link opens those bytes in the browser PDF viewer instead of printing the HTML dialog. A4 pagination and the footnote therefore do not depend on Safari's HTML print layout. Cache keys include all public text and images. Retention is limited to two PDF requests and one rendered document.

## Fonts

Nanum Gothic is distributed under `fonts/OFL.txt` (also shipped in `public/assets/licenses/ReferenceFonts-OFL.txt`). Derived compact fonts use the non-reserved family name Clocktower Reference Sans. With FontTools installed, regenerate from the repository root:

```sh
python3 web/scripts/generate-reference-fonts.py
```

The compact fonts cover current character and Jinx text. A missing character selects the full font, independently for regular/bold. Embed these valid font files without runtime subsetting; runtime fontkit subsetting previously lost Korean bold glyphs. Both compact and fallback fonts and PDF workers are precached for offline use.

## Verification

Run `pnpm --dir web test:custom`, the Rust custom-domain/custom-wasm suites, `pnpm test:custom-runtime`, and `pnpm --dir web build` / `verify:pwa`. Against a manager-owned production preview:

```sh
REFERENCE_PREVIEW=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:PORT/clocktower/ pnpm --dir web exec playwright test --config playwright.reference.config.ts --workers=1
```

The browser suite saves PDFs/screenshots under `web/.codex-tmp/reference-browser`. Verify extracted Korean text and render all pages when changing pagination or fonts. Offline execution is tested in Chromium. The bundled WebKit offline protocol rejected already-cached modules (including the existing landing entry), so that test is explicitly skipped for WebKit. Physical iPhone/iPad offline and print-dialog acceptance remains a device review, separate from automated WebKit rendering coverage.
