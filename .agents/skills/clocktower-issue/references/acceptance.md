# Acceptance

1. Derive a concise manual checklist from user-visible acceptance criteria. Describe actions and expected outcomes, not internal implementation details.
2. Include normal flow, approved edge cases, recovery or failure behavior, and relevant target viewports or devices.
3. Confirm automated checks and code review are complete before asking for acceptance.
4. Start the app with `.agents/skills/clocktower-issue/scripts/test-server.sh start <number> <worktree> [port]`.
5. Verify the script reports a live PID and successful health check. Provide the returned Tailscale URL as a clickable link and keep the process alive after the response.
6. Record the PID/state path and `accept / waiting-for-user` checkpoint before pausing.

On feedback, stop the server first, record the feedback, return to the required phase, and make only the requested corrections. On explicit approval, stop the server, record `accepted / complete`, commit and push that checkpoint update on the issue branch, confirm the worktree is clean, and direct the user to `$clocktower-close-issue #<number>`.
