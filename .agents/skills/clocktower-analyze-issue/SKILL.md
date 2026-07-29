---
name: clocktower-analyze-issue
description: Analyze one Clocktower issue, publish findings and decision questions, and stop before execution. Use to start issue work or continue requirements clarification until analysis is approved.
---

# Analyze Clocktower Issue

Clarify one issue and hand off an approved behavioral scope. Never build a prototype, write an implementation plan, or edit production code.

## Start

1. Require an issue number. Read the GitHub issue and comments with `gh`, `AGENTS.md`, relevant specifications and plans, architecture, implementation, and tests.
2. Create or reuse the issue's dedicated branch and worktree. For a new issue, fast-forward a clean `develop` first. Find or create `docs/plans/issue-<number>-*.md` in that worktree.
3. If its checkpoint is later than analysis, do not overwrite it; report the active phase and direct the user to the matching skill.
4. Write the analysis and `analyze / waiting-for-user` checkpoint to the plan.
5. Resolve factual questions from the repository, issue history, and authoritative rules. Ask the user only for product decisions or irreducible ambiguity.
6. Always send the user a report with these sections:
   - current behavior and problem;
   - requested scope and explicit non-goals;
   - affected ownership boundaries, dependencies, and risks;
   - numbered decisions needed, each with impact and a recommendation.
7. If no material decision is open, say so and ask the user to confirm the analyzed scope.
8. Stop the turn. Do not advance to prototype or invoke `$clocktower-issue` in the same turn.

## Continue clarification

1. Apply the user's answers to the plan and recheck affected facts.
2. Ask focused follow-up questions and stop again if any material ambiguity remains.
3. When the answers fully determine behavior and scope, publish the finalized requirements and acceptance criteria, record whether a UI prototype is required, and set `analysis-approved / complete`.
4. Direct the user to `$clocktower-issue #<number>`; do not start that skill's work in the same turn.

Never treat silence, an inferred preference, or an existing implementation idea as approval. On every invocation, provide a user-facing report rather than only updating files.

## Checkpoint

Keep this compact block near the top of the issue plan:

```markdown
## Workflow checkpoint

- Phase: analyze | analysis-approved
- Status: waiting-for-user | blocked | complete
- Approved: <decision references or none>
- Open questions: <items or none>
- Branch: <branch>
- Worktree: <path>
- Test server: none
- Next action: <one concrete action>
```

Keep detailed findings and decisions in normal plan sections.
