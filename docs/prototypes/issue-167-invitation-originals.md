# Issue #167 Invitation Original Design Archive

## Archive identity

- Status: reusable source archive before the public invitations move to their discarded state
- Baseline commit: `087bb4e` (`main` before issue #167 work)
- Recovery reference: `087bb4e`
- Original production routes: `/clocktower/invitation/260816/` and `/clocktower/invitation/260813/`

The baseline commit is the complete visual recovery point: it retains the original card, its opening
interaction, all assets, and route wiring. The typed record below is the convenient reuse point for
the original copy and asset identities after the public pages are changed.

## Reusable source map

- `web/src/promoCardOriginals.ts` — original TB and SnV copy, heading line breaks, paper textures,
  and wax-seal asset pairings
- `web/src/promoCardPrototype.tsx` — original sealed-packet and opening-card component
- `web/src/promoCardPrototype.css` — original envelope, vellum, ink, and responsive visual treatment
- `web/src/promoCardPrototypeRoute.ts` — development aliases and exact public date routes
- `web/src/assets/promo/letter-vellum-calfskin-v1.jpg` — approved vellum sheet
- `web/src/assets/promo/wax-seal-tb.png` and `web/src/assets/promo/wax-seal-snv.png` — approved seals

| Original | Public route | Record key | Original interaction |
| --- | --- | --- | --- |
| Trouble Brewing | `/invitation/260816/` | `INVITATION_ORIGINALS["trouble-brewing"]` | sealed envelope, click-to-open, invitation acceptance link |
| Sects & Violets | `/invitation/260813/` | `INVITATION_ORIGINALS["sects-and-violets"]` | sealed envelope, click-to-open |

## Reuse rule

For a future invitation that restores either approved original, use the corresponding record from
`INVITATION_ORIGINALS` with `PromoCardPrototype`; keep the original `promoCardPrototype.css` rather
than recreating the paper, envelope, seal, or opening effect from screenshots. The discarded review
prototype introduced for issue #167 is intentionally a separate component and must not replace this
archive as the reusable original.

Retrieve an exact original source file without switching branches, for example:

```sh
git show 087bb4e:web/src/promoCardPrototype.tsx
```
