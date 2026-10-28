# Codex event notification pilot

## Current status (2026-10-28)

The native `send_message_to_thread` tool has passed a real busy-session test: a second
message was acknowledged in the same active turn. Normal message-processing boundaries
satisfy the requirement; zero latency and forced tool interruption are not required.

Automatic Taska-to-desktop delivery is **not connected**. The deployed event outbox is
inactive. Production binding and startup recovery refuse to activate the experimental
queue transport, including when an older binding exists. No project should be enabled
until a supported message adapter passes the full real-session acceptance below.

An ordinary background process running the official app-tools MCP launcher initialized
successfully, but `tools/list` disconnected. The desktop log reported
`dynamic_app_tools_peer_rejected reason=missing-code-signing-identity`. Native tool
success inside Codex does not establish external access from Taska. Do not bypass peer
authorization, impersonate a signed process, inject into private IPC, or patch the app.
A desktop runtime migration or global app restart is not an approved next step.

The installed desktop's public thread deep link accepts a prompt, but its handler only
sets `prefillPrompt` and focuses the composer; it does not submit or steer. Desktop UI
sending was explicitly approved for a one-session pilot, with an existing-draft stop
condition. The real computer-use attempt then refused access to the Codex application
for safety reasons. This route remains unverified and cannot be replaced with scripts
that bypass the same restriction. Do not treat a prefilled draft as delivery. A permitted
desktop automation interface or a supported external message interface is still required.

## What prevents idle model work

- The canonical `/agent` and `/skill` text, plus installed agent skills, prohibit model
  wakeups to check for messages at any frequency. With no work, end the turn. Missing
  event delivery must be reported once; it must not trigger a polling fallback.
- The legacy `tools/waker.py` refuses to run. Its LaunchAgent template disables startup
  and keepalive. Re-enabling the old script is not a supported fallback.
- The outbox uses `threading.Event.wait()` without a timeout. Only committed user events,
  startup recovery of known work, and explicit retries signal it. Agent writes do not
  signal it. Copies of a project database cannot notify the original session.
- At the final delivery boundary, a nonempty batch must match committed user events.
  Already consumed events cannot send again under a different notification ID. A successful
  send is not repeated on retry; an uncertain outcome requires reconciliation.
- `tools/agent_work_guard.py` is a deterministic command hook. It rejects recognizable
  scheduled message checks and shell queue-polling loops, without calling a model or
  running a timer. It does not inspect every possible program or cover every harness.

Codex hook installation is **not enforcement**. New non-managed hooks require user review
and trust through `/hooks` ([official guide](https://learn.chatgpt.com/docs/hooks#review-and-trust-hooks)).
The real 2026-10-28 probe reached a deliberately nonexistent HTTP endpoint instead of
being denied, so the installed hook is not yet active. Claude Code configuration is
installed, but runtime interception has not been validated. Other runtimes currently
receive the rule through instructions only. Do not claim universal enforcement.

## Outbox and experimental API

The project journal is the event source. Its cursor and delivery records are persisted
in the existing key-value store. An event saved before the worker signal can be recovered
without replaying work from before binding. Delivery state and agent acknowledgement
remain separate.

The authenticated project route `/p/<project>/api/codex-notifications` supports:

- `GET`: binding and delivery status; `?id=<notification-id>` reads saved events.
- `POST {"ack":"<notification-id>"}`: receipt acknowledgement, not task completion.
- `POST {"retry":true}`: an explicit attempt for pending or failed known work.
- `POST {"enabled":false}`: disable delivery.
- Binding requests currently return an error because automatic message delivery is not
  connected. There is no supported activation procedure yet.

`server/taska/infra/codex_queue.py` retains the isolated public CLI experiment. `codex queue`
saves a message for the next turn; it does not steer the active turn. A queue receipt is
not proof of agent receipt. A failed wake can reuse its saved queue receipt, but a successful
wake is never repeated just because no acknowledgement has arrived. No timer retries exist.
Failures remain in delivery records and create a visible Taska bug.

## Validation and rollout gate

`npm --prefix web run check` includes the instruction, retired-entrypoint, schedule-audit,
command-hook and outbox regression tests. The schedule audit includes recognized idle
checks for all projects and has no hourly or daily exemption. Hook tests allow ordinary
one-off reads, meaningful scheduled work, and disabling schedules.

The 2026-10-28 deployment passed 50 server tests and 41 frontend tests. Live `/agent`,
`/skill`, installed skills, the disabled waker, and the existing Taska page were checked.
These results do not replace real hook interception or automatic event-delivery acceptance.

Before activation, verify a real browser update reaches the bound session while idle and
while working. Also verify duplicate saves, agent reply isolation, restart recovery and
absence of model calls with no event. Keep other projects unbound until this passes.
Then update the Codex-specific section in `server/taska/agent_text/guide_text.py` and the
installed Codex skill with the verified binding and acknowledgement procedure. Other
agents' transports need their own validation. Safety corrections to existing instructions
must ship immediately and must not wait for completion of the message adapter.
