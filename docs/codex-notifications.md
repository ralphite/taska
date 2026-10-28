# Codex event delivery

## Verified behavior (2026-10-28)

A real Taska browser update reached an existing, busy Codex desktop session in the same
active turn. The outbox recorded `contextSubmittedAt`, the agent acknowledged `received`,
and the native queue was empty afterward. Later tool and stop boundaries did not repeat
that update. This satisfies normal message processing, without forcing tool interruption.
After deploying and restarting Taska, another real browser update also woke the idle
session, received its acknowledgement, and left the native queue empty. Restart did not
replay either previously acknowledged notification. The release passed 55 server tests
and 41 frontend tests, including the empty-inbox and no-idle-work checks.

The first attempt reached the next turn only: the already loaded session retained its
old hook configuration. After it became idle, official archive and unarchive operations
reloaded that same session and its history. The next busy-session attempt passed. Trusting
hooks on disk alone does not prove a loaded desktop session is using them.

## Setup

1. From this checkout, run `python3 tools/install_codex_delivery_hook.py` and
   `python3 tools/install_agent_guard.py`. Both preserve unrelated hook definitions.
2. Review and trust new definitions in the official Codex `/hooks` flow. Never edit trust
   records or bypass review. See the [official hook guide](https://learn.chatgpt.com/docs/hooks).
3. Reload a previously loaded session only after it is idle, using the official archive
   and unarchive tools. Keep the same session ID and history; no global app restart is needed.
4. Bind only the user-authorized project and existing session with
   `POST /p/<project>/api/codex-notifications`:
   `{"threadId":"<session-UUID>","mode":"queue-hook","pilot":true}`.
5. Verify an authorized real update reaches that session while busy. A queue receipt,
   installation success, or receipt only in a later turn does not establish busy delivery.

The canonical `/agent`, `/skill`, and installed Taska skills include these Codex-specific
instructions. Do not apply this adapter to Claude Code or other runtimes. Do not infer
bindings for other projects from the one-session acceptance.

## Delivery and ownership

The committed project journal is the outbox source. An event signals a deterministic
worker, which queues the message through the public `codex queue` command and publishes
a local pointer under the project data folder. The desktop wake link handles idle turns.
No second CLI writer resumes the session, and no relay model is involved.

At normal PreToolUse, PostToolUse, and Stop boundaries, the trusted hook consumes pushed
pointers for its own session. An empty inbox performs no HTTP request and emits no context.
The hook claims the exact native queue entry with public `thread/queue/delete`:

- Confirmed deletion: hand the update to the active turn as hook context.
- Already consumed by the desktop: the native turn owns delivery; emit no duplicate.
- Uncertain claim: retain a visible failure for reconciliation; never blindly resend.

Each hook emits one claimed message before attempting another fallible claim. A later
failure cannot discard an earlier successful claim. Stop continues the model only for an
actual new update. The agent acknowledges receipt separately from completing the work.

This is not a universal exactly-once transaction across Codex and Taska. A crash after
queue deletion but before model context delivery can leave an unacknowledged `context`
record. Reconcile it explicitly; do not turn missing acknowledgement into timed retries.

## API

The project notification endpoint supports:

- `GET`: binding and delivery records; `?id=<notification-id>` reads saved events.
- `POST {"ack":"<notification-id>"}`: receipt, not task completion.
- `POST {"hook":"<notification-id>","sessionId":"<session-UUID>"}`: hook claim of a pushed pointer.
  Agents must not call this to check for messages.
- `POST {"retry":true}`: explicit retry of known pending or failed work.
- `POST {"enabled":false}`: disable delivery.

Queue-only activation remains refused. Failed deliveries create a visible Taska item.
Already sent work is not sent again merely because receipt has not arrived. Data copies
cannot send to the original session because the persisted project path must match.

## Preventing idle model work

- No timer, heartbeat, cron, model relay or repeated message query exists in this adapter.
  The worker waits on a threading event without a timeout. Only actual events, startup
  recovery of known work, and explicit retry signal it.
- The final delivery boundary requires nonempty, unconsumed committed user events.
  Agent replies, duplicate signals, fabricated batches and empty queues cannot call Codex.
- The retired `tools/waker.py` refuses to run; its LaunchAgent remains disabled.
- The command-only PreToolUse guard rejects recognizable scheduled message checks and
  shell queue-polling loops. After official trust, the live Codex probe was denied before
  its deliberately nonexistent HTTP endpoint was contacted.
- `npm --prefix web run check` includes instruction, outbox, hook, retired-entrypoint and
  schedule-audit regressions. There are no hourly or daily exemptions for idle model checks.

Hooks are a runtime guardrail, not an OS-wide sandbox. Claude Code's guard configuration
is installed, but its actual interception is not covered by this Codex acceptance. Other
runtimes currently receive the rule through instructions. Do not claim universal enforcement.
