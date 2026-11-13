"""Taska's waker for the Antigravity session that runs a project (B762, Yadong r1283 r1286).

Antigravity's own message command only works from its own terminal (its address and token), so Taska cannot wake a
session from outside. Instead the session starts one small program in its terminal (the script below, at
BASE/waker), and starts it again before each turn ends; it returns at once when one already runs. The program holds
GET BASE/wake: Taska answers "wake" when there is work for the session and the session is idle (its last /next had
nothing for it), then it sends the session one message and waits again. A woken session that does not call /next
within 10 minutes is woken once more; nothing is sent while it works.

Nothing about it shows on the page while it works (r1286). Only when the user writes to the project and no waker has
waited for the session for 15 minutes does Taska say so, once, as an item (proposed); when a waker waits again
it is deleted, unless the user answered it. Callers hold the project lock unless a method says otherwise.
"""

from __future__ import annotations

import threading
import time
from typing import TYPE_CHECKING, Callable, Dict, Optional

from ..domain import events as ev

if TYPE_CHECKING:
    from .project import Project

KEY = "antigravity-waker-alarm"
REWAKE = 600  # seconds a woken session has to call /next before it is woken again
GONE = 900  # seconds without a waker before the user hears of it (only when they write to the project)

SCRIPT = r"""#!/bin/sh
# Taska's waker for one Antigravity session (B762). Run in the session's own terminal:
#   curl -s "{base}/waker" | sh -s "$ANTIGRAVITY_CONVERSATION_ID"
# It returns at once; a waker that already runs for this session is left as it is.
sid="$1"
case "$sid" in ""|*[!A-Za-z0-9-]*) echo "waker: no session id"; exit 1;; esac
pidf="$HOME/.gemini/taska-waker-{slug}-$sid.pid"
if [ -f "$pidf" ] && kill -0 "$(cat "$pidf")" 2>/dev/null; then echo "waker: running"; exit 0; fi
nohup sh -c '
  echo $$ > "$1"
  fails=0
  while :; do
    o=$(curl -s "$2/wake?wait=540&sid=$3")
    case "$o" in
      "") sleep 20; continue;;
      wake*) ;;
      stop*|replaced*) break;;
      *) continue;;
    esac
    if "$HOME/.gemini/antigravity/bin/agentapi" send-message --title=Taska "$3" "Taska has work for you: GET $2/next?by=antigravity&sid=$3 and do it." >/dev/null 2>&1; then
      fails=0
    else
      fails=$((fails + 1)); [ "$fails" -ge 5 ] && break; sleep 30
    fi
  done
  rm -f "$1"' waker "$pidf" "{base}" "$sid" >/dev/null 2>&1 &
echo "waker: started"
"""


class Waker:
    def __init__(self, project: "Project", clock: Callable[[], float] = time.time):
        self.p = project
        self.clock = clock
        self.started = clock()
        self.idle: Dict[str, bool] = {}  # per session: its last /next had nothing for it
        self.woke: Dict[str, float] = {}  # per session: when it was last woken
        self.asked: Dict[str, float] = {}  # per session: when it last called /next
        self.waiting: Dict[str, int] = {}  # per session: wakers holding /wake now
        self.seen: Dict[str, float] = {}  # per session: when a waker last held /wake

    # -- the session's own calls -------------------------------------------------------

    def next_read(self, sid: str, has_work: bool) -> None:
        """The session called /next: it is idle when that had nothing for it."""
        self.asked[sid] = self.clock()
        self.idle[sid] = not has_work

    def due(self, sid: str) -> bool:
        """Whether the session may be woken now: idle, or woken a while ago and silent since."""
        if self.idle.get(sid, True):
            return True
        woke = self.woke.get(sid)
        return bool(woke and self.asked.get(sid, 0) <= woke and self.clock() - woke > REWAKE)

    def woken(self, sid: str) -> None:
        self.woke[sid] = self.clock()
        self.idle[sid] = False

    # -- the waker's wait --------------------------------------------------------------------

    def holding(self, sid: str, n: int) -> None:
        """A waker starts (+1) or stops (-1) holding /wake for the session."""
        self.waiting[sid] = max(0, self.waiting.get(sid, 0) + n)
        self.seen[sid] = self.clock()
        alarm = self.p.store.db.get(KEY)
        if n > 0 and isinstance(alarm, dict) and alarm.get("sid") == sid:
            self.p.store.db.put(KEY, None)  # it is back: the alarm went away, so its item does, unless answered
            ref = alarm.get("ref")
            if ref:
                self.p.run([(0, {"op": "idel", "ref": ref})], "taska")

    # -- telling the user, only when it does not work ------------------------------------

    def on_event(self, event: ev.Event) -> None:
        """Called after Project.emit commits an event; never on a timer. The item is made apart from that change."""
        if event.by == "you" and isinstance(event, (ev.InputAdded, ev.InputSent)) and self._gone() is not None:
            threading.Thread(target=self.alarm, name="waker-alarm-" + self.p.slug, daemon=True).start()

    def _gone(self) -> Optional[str]:
        """The session that runs the project, when no waker has waited for it for a while and it was not said yet."""
        lead = self.p.agents.lead
        if not lead or self.p.gone or self.p.store.db.get(KEY):
            return None
        sid = lead[0]
        if self.waiting.get(sid) or self.clock() - self.seen.get(sid, self.started) < GONE:
            return None
        return sid

    def alarm(self) -> None:
        """Say it once, as an item (call without the lock)."""
        with self.p.lock:
            sid = self._gone()
            if sid is None:
                return
            self._say(sid)

    def _say(self, sid: str) -> None:
        lines, _ = self.p.run([(0, {
            "op": "new", "type": "bug", "pri": "P1", "when": "now",
            "title": "Antigravity does not hear from Taska",
            "body": ("The Antigravity session that runs this project has not waited for Taska for over 15 minutes: "
                     "what you write does not reach it. Say a word in that session and it connects again; then this "
                     "item goes by itself."),
        })], "taska")
        ref: Optional[str] = lines[0].split()[1] if lines and lines[0].startswith("ok ") else None
        self.p.store.db.put(KEY, {"sid": sid, "ref": ref})
