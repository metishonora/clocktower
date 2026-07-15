# First-night Suggestion Prototype Notes

Run `pnpm prototype:first-night-suggestion`, then open:

`http://localhost:5173/?prototype=first-night-suggestion&scenario=washerwoman`

## Final prototype decision

- Use the inline action in the candidate-input header.
- Use `무작위 추천` before the first use and `다시 추천` afterward.
- Do not add a second suggestion action near the confirmation controls.
- Keep the ordinary `확정` button visually and behaviorally separate from suggestion.
- Show feedback only when no complete suggestion can be built. The failure tells the Storyteller to
  check Actual Character assignment and available Trouble Brewing Characters, and leaves the current
  input unchanged.

## Prototype behavior

- Normal Washerwoman, Librarian, and Investigator pools enumerate every distinct Player pair for each
  represented Actual Character of the required kind.
- An impaired setup-information pool enumerates every distinct Player pair with every ability-shaped
  Character, so the result may be false.
- Librarian uses the zero-Outsider input only when the prototype roster has no Actual Outsider.
- Demon suggestions enumerate every three-Character combination from the legal bluff allowlist.
- Browser use samples those complete pools with `crypto.getRandomValues`. Tests inject a deterministic
  index chooser.
- Re-suggestion excludes the current complete draft whenever another option exists, then replaces all
  draft fields in one state update.
- The defensive failure tab models fewer than three Demon bluff candidates. A legal Trouble Brewing
  setup should normally never reach this state. This only prevents an exact-three suggestion; the
  existing Demon input still permits manually confirming zero, one, or two legal bluffs.
- A fixed Washerwoman, Librarian, or Investigator step with no suggestion indicates an invalid Actual
  Character roster or a blocked/inconsistent step, not ordinary partial progress.

This remains a development-only product prototype. Its dedicated CSS is imported only with the lazy
development route; the production entry and global stylesheet do not import this module or its CSS.
Production integration must not copy its hard-coded players, allowlists, or rule derivation.
