# Acceptance

1. Derive a concise manual checklist from user-visible acceptance criteria. Describe actions and expected outcomes, not internal implementation details.
2. Include normal flow, approved edge cases, recovery or failure behavior, and relevant target viewports or devices.
3. Confirm automated checks and code review are complete before asking for acceptance.
4. Identify the real production entry and the shortest production-supported setup for the checklist. A fixture is allowed only when loaded through the production import or state path.
5. Start the app with `.agents/skills/clocktower-issue/scripts/test-server.sh start <number> <worktree> [port]`.
6. Open the exact production URL without `?prototype=` or a development harness and smoke-test the changed behavior through the real app wiring.
7. If that production check is unavailable, do not ask for acceptance: return to `implement / active` for missing implementation, or record `accept / blocked` for an external validation blocker.
8. Verify the server PID and health check, then provide the exact production Tailscale URL as a clickable link and keep it alive after the response. Record the tested commit, URL, PID/state path, and `accept / waiting-for-user` checkpoint before pausing.

On feedback, stop the server first, record the feedback, return to the required phase, and make only the requested corrections. On explicit approval, stop the server, record `accepted / complete`, commit and push that checkpoint update on the issue branch, confirm the worktree is clean, and direct the user to `$clocktower-close-issue #<number>`.
