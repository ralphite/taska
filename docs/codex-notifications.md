# Codex event delivery

A committed user update sends this short notice to the project's bound Codex session:

> Taska has new messages. Please read and handle them.

The runtime uses the equivalent Chinese wording. The notice contains no URL, project name,
identity assumption, event contents, sequence number or acknowledgement request. The agent
uses its existing Taska connection to read the work and writes progress through the normal
Taska interface.

## Transport

The event handler starts a bounded ordinary-code send outside the project lock: `codex queue`
followed by `open -g codex://threads/wake/<thread-id>`. Codex owns the queue. An idle session
starts processing; a busy session handles the queued message after its current turn ends.
Taska does not inspect busy/idle state, maintain a notification outbox, deduplicate signals,
claim notifications, request receipts, poll, or retry on a timer. Repeated signals are allowed.
Agent writes do not trigger another notification, nor does a recording kept as cancelled (or its words)
until the user sends it. A send failure is reported in Taska.

`GET /p/<project>/api/codex-notifications` reads the binding and any reported failure.
`POST` with `{"threadId":"<existing-session-UUID>"}` explicitly binds or rebinds a session;
`{"enabled":false}` disables sending. Existing bindings are preserved when the old delivery
ledger is removed. Startup does not replay work. Copies of a bound database cannot send to
the original session because the stored project path must match.

No delivery hook is installed or required. The old receiver file only returns an empty
result so sessions with a cached hook command can finish safely. Its installer is removed.
Claude Code's transport, settings and installed instructions are unchanged.

## Visible worker sessions

The Codex instructions ask the main session to create or reuse 1-3 ordinary, user-visible
worker sessions in the same Codex project. The main session assigns work, stays available,
and sends new requirements to the relevant worker, steering it while busy. Workers read
and write Taska directly; the main session does not aggregate their results. A worker may
use subagents when useful. Reuse and task-based allocation avoid idle or duplicate workers.
This is agent guidance, not a new Taska orchestration service.

## Evidence

On 2026-10-29, a real desktop session received a native queued message while its first turn
was busy. Once that turn completed, the next turn started automatically and acknowledged
the test. The native queue was empty afterward and no hook pointer was used. Both the
initial idle wake and busy-to-next-turn delivery worked through `queue + wake` alone.

After deployment on the same date, a real update through Taska's page-command endpoint
sent exactly the short notice to the existing main session. The main session created one
ordinary visible worker in the same Codex project and ended its turn. That worker read
Taska and wrote its evidence directly to the task. Worker progress and final writeback did
not start another main-session turn. Installed Claude skill and settings hashes were unchanged.
The test card remained proposed under Taska's existing approval rules; those rules were not
changed or bypassed. The unnecessary completion-status blocker was withdrawn by the worker.
