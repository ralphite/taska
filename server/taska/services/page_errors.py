"""Errors the page did not catch become bugs (T860, after T859): the page's errors were in the log (T859's blank page
19 times in 11 projects) and nothing read them until Yadong ran into it. One bug in the taska project for each error
in the page's code, as soon as a page reports it:
- only the code's own errors (TypeError, ReferenceError ...): not what the page tells as an error on purpose (Taska
  has an update, a microphone refused) nor the browser's own noise (ResizeObserver);
- only from the page this Taska serves now: a page still open from before an update reports what was fixed since;
- one per error: none while the bug made for it is open; once that is closed, the error coming back makes a new one;
- at most PER_DAY a day, so a broken page cannot fill the list.
Nothing runs on a timer: it is worked out when a page reports an error."""

from __future__ import annotations

import re
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

from ..domain.vocab import CLOSED

CODE_ERROR = re.compile(r"\b(TypeError|ReferenceError|RangeError|SyntaxError|URIError)\b")
KEY = "pageerrors"  # in the taska project's db: {error: code of the bug made for it}
PER_DAY = 5
DAY = 86400.0


def error_key(msg: str) -> str:
    """The same error however the browser words its start (Chrome's 'Uncaught ')."""
    return re.sub(r"\s+", " ", re.sub(r"^Uncaught (\(in promise\) )?", "", msg.strip()))[:200]


def worth_a_bug(e: Dict[str, Any], build: str) -> bool:
    """An error in the page's code, from the page served now (its main script, `build`, is in the error's stack)."""
    msg, stack = str(e.get("msg") or ""), str(e.get("stack") or "")
    return bool(build) and bool(CODE_ERROR.search(msg)) and f"/assets/{build}" in stack


def bug_text(e: Dict[str, Any], slug: str, build: str, when: str) -> Tuple[str, str]:
    """(title, body) of the bug made for an error."""
    msg = error_key(str(e.get("msg") or ""))
    stack = "\n".join(str(e.get("stack") or "").split("\n")[:6])
    body = (f"页面出错了，没被接住：`{msg}`\n\n"
            f"- 项目：{slug}\n- 页面：{e.get('where') or '?'}\n- 第一次：{when}\n- 页面版本：{build}\n"
            f"- 浏览器：{str(e.get('ua') or '?')[:160]}\n\n"
            f"```\n{stack}\n```\n\n"
            "完整记录在日志里（来源 page、类型 error）。这是自动建的（T860）：这件没关掉之前，同一个错不会再建；"
            f"每天最多建 {PER_DAY} 件。")
    return f"页面报错：{msg[:80]}", body


class PageErrorBugs:
    def __init__(self, clock=time.time) -> None:
        self.lock = threading.Lock()
        self.clock = clock
        self.made: List[float] = []  # when bugs were made, for PER_DAY

    def seen(self, e: Dict[str, Any], slug: str, build: str, taska: Optional[Any]) -> Optional[str]:
        """A page reported an error: the code of the bug made for it, or None (not worth one, or one is open)."""
        if taska is None or not worth_a_bug(e, build):
            return None
        key = error_key(str(e.get("msg") or ""))
        with self.lock:
            now = self.clock()
            self.made = [t for t in self.made if now - t < DAY]
            if len(self.made) >= PER_DAY:
                return None
            with taska.lock:
                made = taska.store.db.get(KEY)
                made = made if isinstance(made, dict) else {}
                ref = made.get(key)
                if ref and self._open(taska, ref):
                    return None
                when = time.strftime("%m-%d %H:%M", time.localtime(now))
                title, body = bug_text(e, slug, build, when)
                lines, _ = taska.run([(0, {"op": "new", "tags": ["bug"], "pri": "P1", "when": "now", "title": title,
                                           "body": body})], "taska")
                got = lines[0].split()[1] if lines and lines[0].startswith("ok ") else None
                if not got:
                    return None
                taska.store.db.put(KEY, {**made, key: got})
            self.made.append(now)
            return got

    @staticmethod
    def _open(taska: Any, ref: str) -> bool:
        it = next((x for x in taska.state.tasks.values() if taska.state.code(x.n) == ref), None)
        return it is not None and it.status not in CLOSED and not it.archived
