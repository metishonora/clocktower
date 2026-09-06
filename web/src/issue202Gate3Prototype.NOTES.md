# Issue 202 · Gate 3 prototype

## Review scope

- Keep the approved Issue #200 character-pool screen as the Step 2 baseline; Gate 2 has no separate prototype.
- Use one responsive structure for Step 3: first/other tabs on narrow screens and paired sections on desktop.
- Use the same order-row interaction model for both nights.
- Show fixed dusk/dawn boundaries, movable first-night system entries, ordinary character entries, and conditional other-night entries.
- Exercise default, edited, Character-pool reconciliation, and invalid/recovery states.
- Keep review-only fixture and alternative controls outside the product surface.

## Approved inputs retained

- Gate 1 approved on 2026-09-06.
- Landing choices: three flat choices.
- Product progress: chapter title only.
- Entry transition: circular ink bloom from the Custom Scenario logo.
- Panel creation animation after entry remains the Gate 1 baseline.

## Gate 3 revision decisions · 2026-09-06

- Do not support drag-and-drop; use explicit up/down movement controls.
- Use tabs on mobile and paired first/other-night sections on desktop without a user-facing layout preference.
- Shorten each order entry substantially instead of stretching it across the available panel width.
- Increase entry height slightly and present the order as wooden plaques connected by cord; preserve system, conditional, invalid, and fixed-boundary distinctions within that theme.
- Refine each plaque as a handcrafted elongated tag rather than a box: asymmetric rounded ends, layered grain, matte bevel, soft depth, and a drilled hole aligned with its cord connection.
- Reference-image refinement: align each night as a single vertical stack of light oak paddles suspended from two braided cords, with two visible drilled holes per plaque and dark engraved-looking controls.
- Theme refinement: age the plaques with scorched edges, uneven stains, small chips, and hairline cracks; replace the neutral cords with muted red thread drawn from the manuscript palette.
- Reordering uses a position-swap animation so both the selected plaque and its displaced neighbor visibly travel to their new positions. Reduced-motion preference disables this movement.
- Motion refinement: use a 720ms standard in-screen easing curve for the selected plaque, briefly lift it to 102.5%, and let the displaced plaque follow after 55ms over 660ms. Movement controls lock for the 760ms exchange window so each positional change completes without interruption or snapping.
- Cord tracks use the full rendered list height rather than the scroll viewport height, keeping both red threads continuous when lower entries are revealed.
- Remove the repeated diagonal distress marks; keep aging concentrated in irregular grain and scorched/chipped edges, and prioritize high-contrast role names and metadata.

## Prototype boundary

- Typed local fixtures only; no Rust, WASM, persistence, import/export, scheduler, or runtime activation behavior.
- The order data is a review fixture assembled from supported Trouble Brewing and Sects & Violets Character IDs. It does not establish an exact production order contract.
- The Step 2 and Step 4 destinations remain bounded silhouettes in this Gate. The approved Issue #200 prototype remains the visual baseline for Step 2.
