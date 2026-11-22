"""How the voice notes have been heard lately (T822, Yadong r1405), for every project of this Taska at once:
- when the strong model's next model is asked beside it: after as many seconds as nine in ten of its latest answers
  took (17 s until it has answered ten times), so a try that will not answer is not waited for;
- when hearing has got slow, one bug in the taska project, with the numbers: of the latest 30 notes, more than one
  in five whose strong model did not answer its first try, or one whose final words took over 60 s. While that bug is
  open no other is made; once it is closed, only notes heard after it count.
Read from the notes' records (<project>/taska-files/*.tr.json) when Taska starts, then kept as notes are heard. No
model is asked, no timer runs: it is worked out after each note."""

from __future__ import annotations

import glob
import json
import os
import threading
import time
from collections import deque
from typing import Any, Deque, Dict, Iterable, List, Optional, Tuple

from ..domain.vocab import CLOSED

WINDOW = 30  # notes
HEDGE_FIRST, HEDGE_MIN, HEDGE_MAX = 17.0, 8.0, 30.0  # seconds; HEDGE_MAX: the try's own wait (transcribe.PRO_TRY)
HEDGE_SEEN = 10  # answers before the time is the strong model's own
ALARM_RATE, ALARM_SECS, ALARM_SEEN = 0.2, 60.0, 10
SINCE = "voice-health.json"  # in the data folder: when counting started again (the last bug made), kept over restarts
KEY = "voicealarm"  # in the taska project's db: the bug made, so no second one is made while it is open


def hedge_after(answered: Iterable[float]) -> float:
    """After how many seconds with no answer the next model is asked: as long as nine in ten of these answers took."""
    xs = sorted(answered)
    if len(xs) < HEDGE_SEEN:
        return HEDGE_FIRST
    p90 = xs[min(len(xs) - 1, int(len(xs) * 0.9))]
    return float(min(HEDGE_MAX, max(HEDGE_MIN, round(p90 + 0.49))))


def alarm(tries: List[bool], totals: List[float], hedge: float) -> Optional[Tuple[str, str]]:
    """(title, body) of the bug to make when hearing has got slow, or None. tries: whether the strong model answered
    its first try, note by note; totals: how long each note took to its final words."""
    failed = tries.count(False)
    slow = max(totals) if totals else 0.0
    rate = len(tries) >= ALARM_SEEN and failed / len(tries) > ALARM_RATE
    if not rate and slow <= ALARM_SECS:
        return None
    body = (f"最近 {len(tries)} 条语音里，强模型第一次没回答的有 {failed} 条（{round(100 * failed / max(1, len(tries)))}%）；"
            f"最近 {len(totals)} 条里最慢的一条 {slow:.0f} 秒才出最终文字。界线是：最近 30 条里超过 2 成没回答，或有一条超过 60 秒。"
            f"\n\n现在强模型 {hedge:.0f} 秒没回答，就同时问备用模型。每条语音的每一步记在它旁边的 .tr.json 里。"
            f"\n\n这是自动监控开的（T822）：这件事没关掉之前，不会再开第二件。")
    return "语音转文字变慢了", body


def note_records(root: str, n: int = WINDOW, since: float = 0) -> List[Dict[str, Any]]:
    """The latest n notes' records of every project here heard after `since` (a time), oldest first."""
    paths = [x for x in glob.glob(os.path.join(root, "*", "*-files", "*.tr.json")) if os.path.getmtime(x) > since]
    paths.sort(key=lambda x: os.path.getmtime(x))
    out = []
    for p in paths[-n:]:
        try:
            with open(p, encoding="utf-8") as f:
                out.append(json.load(f))
        except (OSError, ValueError):
            continue
    return out


def first_try(rec: Dict[str, Any]) -> Optional[Tuple[bool, float]]:
    """What a record says the strong model's first try came to: (answered, seconds), or None (not known)."""
    for s in rec.get("steps") or []:
        if s.get("step") == "pro" and "secs" in s and ("text" in s or "error" in s):
            return "error" not in s, float(s["secs"])
    return None


class VoiceHealth:
    def __init__(self, root: str) -> None:
        self.root = os.path.abspath(os.path.expanduser(root))
        self.lock = threading.Lock()
        self.tries: Deque[Tuple[bool, float]] = deque(maxlen=WINDOW)
        self.totals: Deque[float] = deque(maxlen=WINDOW)
        self.read = False

    def _since(self) -> float:
        try:
            with open(os.path.join(self.root, SINCE), encoding="utf-8") as f:
                return float(json.load(f).get("since") or 0)
        except (OSError, ValueError, AttributeError):
            return 0.0

    def _again(self) -> None:
        """Counting starts again now, also after a restart (T825: a restart read the notes counted before back in)."""
        self.tries.clear()
        self.totals.clear()
        try:
            with open(os.path.join(self.root, SINCE), "w", encoding="utf-8") as f:
                json.dump({"since": time.time()}, f)
        except OSError:
            pass

    def _read(self) -> None:
        if self.read:
            return
        self.read = True
        for rec in note_records(self.root, since=self._since()):
            t = first_try(rec)
            if t:
                self.tries.append(t)
            total = (rec.get("times") or {}).get("total")
            if isinstance(total, (int, float)):
                self.totals.append(float(total))

    def hedge(self) -> float:
        with self.lock:
            self._read()
            return hedge_after(secs for ok, secs in self.tries if ok)

    def heard(self, ok: bool, secs: float) -> None:
        with self.lock:
            self._read()
            self.tries.append((ok, secs))

    def done(self, total: Optional[float]) -> Optional[Tuple[str, str]]:
        """A note has its words: the bug to make, if hearing has got slow (then counting starts again)."""
        with self.lock:
            self._read()
            if isinstance(total, (int, float)):
                self.totals.append(float(total))
            said = alarm([ok for ok, _ in self.tries], list(self.totals), hedge_after(s for ok, s in self.tries if ok))
            if said:
                self._again()
            return said

    def report(self, said: Tuple[str, str], project: Any) -> None:
        """Make the bug in the taska project, unless the one made before is still open (call without its lock)."""
        with project.lock:
            made = project.store.db.get(KEY)
            ref = made.get("ref") if isinstance(made, dict) else None
            if ref:
                it = next((x for x in project.state.tasks.values() if project.state.code(x.n) == ref), None)
                if it is not None and it.status not in CLOSED and not it.archived:
                    return
            title, body = said
            lines, _ = project.run([(0, {"op": "new", "tags": ["bug"], "pri": "P1", "when": "now", "title": title,
                                         "body": body})], "taska")
            got = lines[0].split()[1] if lines and lines[0].startswith("ok ") else None
            project.store.db.put(KEY, {"ref": got})
