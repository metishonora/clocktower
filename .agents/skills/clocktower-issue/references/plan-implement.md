# Plan and implementation

## Plan

Start only after the prototype is approved or explicitly skipped.

1. Consolidate approved decisions into acceptance criteria and explicit non-goals.
2. Define architecture, public contracts, state ownership, data flow, error and recovery behavior, compatibility or migration needs, file ownership, and rollout risks.
3. Map each acceptance criterion to the smallest stable behavioral test seam and list required regression checks.
4. Identify expected files without prescribing unnecessary private helper structure.
5. Update the issue plan, set the checkpoint to `plan / waiting-for-user`, and request production-plan approval.

## Implement

Start only after explicit plan approval.

1. Brief the user in commentary with the small set of behaviors that will be tested.
2. Write the smallest black-box behavioral or regression test before production edits and confirm it fails for the intended behavioral reason.
3. Implement the smallest production change without weakening the approved test. Explain before changing an approved test.
4. Refactor only after the test passes. Add implementation-coupled unit tests only where they add distinct value.
5. Run focused checks while iterating, then all relevant project-required suites and builds.
6. Review the complete diff for scope, correctness, regressions, missing coverage, generated artifacts, and accidental UI copy.
7. Commit and push the issue branch when it is ready for acceptance. Do not merge into `develop` or close the issue.
8. Record test commands, results, review findings, commit, and branch in the issue plan, then advance to `accept`.
