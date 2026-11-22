"""What agents read to bring back a session that lost its connection to Taska (T833): the message the lost session
gets, the narrow job a connected session is handed, and the list a new session works through when none is
connected. `root` is Taska's own address on this machine (the sessions run here)."""

from __future__ import annotations

from typing import Dict, List, Optional

AGENTAPI = '"$HOME/.gemini/antigravity/bin/agentapi"'


def message(root: str, app: str, slug: str, sid: str, why: str = "lost", task: str = "") -> str:
    """What the lost session is told: reconnect, then go on (one line, no single quotes: it goes in a shell string).
    `why` "work": it is idle while work waits for it (T869): take it."""
    base = f"{root}/p/{slug}"
    if why == "work" and app == "claude-code":
        return (f"Taska: work waits in project {slug}{f' ({task})' if task else ''} and no session is on it. Run "
                f"curl -s \"{base}/next?by=claude-code&sid=$CLAUDE_CODE_SESSION_ID\" and do as it says; when you wait for "
                f"work, wait with the Taska script: curl -s \"{base}/listen?by=claude-code\" | sh (Bash run_in_background).")
    if app == "antigravity":
        return (f"Taska: this session lost its connection to Taska (the machine restarted). Reconnect: GET "
                f"{base}/next?by=antigravity&sid={sid} and do as it says, then start your waker again: "
                f"curl -s \"{base}/waker\" | sh -s \"$ANTIGRAVITY_CONVERSATION_ID\". Then go on with what you were doing.")
    return (f"Taska: this session lost its connection to Taska (the machine restarted). Reconnect: run "
            f"curl -s \"{base}/next?by=claude-code&sid=$CLAUDE_CODE_SESSION_ID\" and do as it says; with nothing to do, "
            f"wait with the Taska script: curl -s \"{base}/listen?by=claude-code\" | sh (Bash run_in_background). "
            "Then go on with what you were doing.")


def _send(app: str, sid: str, desktop: Optional[Dict[str, object]], msg: str) -> str:
    """How to send `msg` to the lost session, from a session of the same app."""
    if app == "antigravity":
        return f"from your terminal:\n  {AGENTAPI} send-message --title=Taska {sid} '{msg}'"
    if desktop:
        to = desktop["id"]
        return f"with SendMessage to \"{to}\" (or mcp__ccd_session_mgmt__send_message, session_id \"{to}\"):\n  {msg}"
    return (f"with SendMessage (or mcp__ccd_session_mgmt__send_message) to the Claude app's session whose record in "
            f"~/Library/Application Support/Claude/claude-code-sessions/*/*/local_*.json has \"cliSessionId\": \"{sid}\" "
            f"(its id is that file's name, local_...):\n  {msg}")


def relay(root: str, app: str, slug: str, sid: str, name: str, desktop: Optional[Dict[str, object]], why: str = "lost",
          task: str = "") -> str:
    """The narrow job for a connected session (Yadong r1433: first, and only this; then back to its own work)."""
    who = f"the {'Antigravity conversation' if app == 'antigravity' else 'Claude session'} \"{name or sid[:8]}\" (project {slug})"
    what = (f"Taska asks you to wake {who}: work waits for it ({task or 'a task'}) and it is idle" if why == "work" else
            f"reconnect first: the user asked you to bring back {who}, which lost its connection to Taska")
    return (f"{what}. Do only this, then go back to what you were doing.\n"
            f"Send it this message {_send(app, sid, desktop, message(root, app, slug, sid, why, task))}\n"
            f"Write about it nowhere (no task, no message). Then GET /next again, or start your wait again, as before.\n")


def all_lost(root: str, app: str, rows: List[Dict[str, object]]) -> str:
    """For a new session the user started to bring back every lost session of `app` (none was connected)."""
    if not rows:
        return "No session waits to be brought back now. You are done.\n"
    out = [f"Bring back these {len(rows)} sessions that lost their connection to Taska: send each the message given "
           "with it. Then say in one line how many you sent, and you are done: you do not connect to Taska yourself."]
    for i, r in enumerate(rows, 1):
        sid, slug, name = str(r["sid"]), str(r["slug"]), str(r["name"])
        desktop = r.get("desktop")
        out.append(f"{i}. \"{name or sid[:8]}\" (project {slug}): send it this message "
                   + _send(app, sid, desktop if isinstance(desktop, dict) else None, message(root, app, slug, sid)))
    return "\n".join(out) + "\n"


def new_session(root: str, app: str) -> str:
    """What the user gives a new session when no session of `app` is connected to send it."""
    return (f"Bring back the Taska sessions that lost their connection: run curl -s \"{root}/api/reconnects?app={app}\" "
            "and do what it says. Then you are done.")


# T869: the scripts Taska gives so that waiting for work is Taska's, not a loop each session writes (and may change)
LISTEN = """#!/bin/sh
# Taska's wait for work for a Claude Code session (T869). Start it with Bash run_in_background and end your turn:
#   curl -s "{base}/listen?by={by}" | sh
# It costs no tokens while it waits; it ends, printing what to do, on any work for this session (a task, the user's
# words, a session writing to it), which wakes the session. Run it as it is: a wait that ends only on one task leaves
# the rest to nobody.
B='{base}'
S="${{1:-$CLAUDE_CODE_SESSION_ID}}"
while o=$(curl -s "$B/next?wait=540&by={by}&sid=$S&listen=1{session}"); [ -z "$o" ] || echo "$o" | grep -q 'nothing to do now'; do sleep 20; done
echo "$o"
"""

DISPATCH = """#!/bin/sh
# Taska's dispatcher wait (T869): it ends with a session to wake (its job, word for word), which wakes this session.
#   curl -s "{root}/dispatch" | sh
S="${{1:-$CLAUDE_CODE_SESSION_ID}}"
while o=$(curl -s "{root}/api/dispatch?wait=540&sid=$S"); [ -z "$o" ] || echo "$o" | grep -q 'nothing to do now'; do sleep 20; done
echo "$o"
"""


def dispatcher(root: str) -> str:
    """What the user gives one Claude session to make it Taska's dispatcher (T869)."""
    return (f"You are Taska's dispatcher on this computer. Your only job: when Taska asks, wake another Claude session "
            f"so it takes the work waiting for it. Start this with Bash run_in_background and end your turn: "
            f"curl -s \"{root}/dispatch\" | sh   When it ends, it prints one job: do exactly that (send the message it "
            f"gives to the session it names, with SendMessage or mcp__ccd_session_mgmt__send_message), then start the "
            f"same command again and end your turn. Do nothing else, write nothing anywhere, and never wait, poll or "
            f"set a timer in the foreground.")
