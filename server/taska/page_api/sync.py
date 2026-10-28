"""Keeping a page's copy of a project up to date with as little as possible: each item, input and document carries
the change number at which its view last changed; a page names the number its copy is at (its cursor) and gets only
what changed after it, and the keys of what went. Changes are found by comparing what would be sent with what was,
so none is missed. A cursor from before a restart gets everything."""

from __future__ import annotations

import hashlib
import json
import threading
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional, Tuple

KINDS = (("items", "n"), ("inputs", "id"), ("docs", "d"))
Entities = Dict[str, List[Dict[str, Any]]]


@dataclass(frozen=True)
class Cursor:
    boot: str
    number: int  # entity change number
    rev: int  # the project's change counter when it was given
    agents: int  # the agents' version when it was given

    def __str__(self) -> str:
        return f"{self.boot}.{self.number}.{self.rev}.{self.agents}"

    @staticmethod
    def parse(text: str) -> Optional["Cursor"]:
        parts = (text or "").split(".")
        if len(parts) != 4:
            return None
        try:
            return Cursor(parts[0], int(parts[1]), int(parts[2]), int(parts[3]))
        except ValueError:
            return None


class Feed:
    """One project's entity change numbers, as last served (callers hold the project lock)."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._seen: Dict[Tuple[str, Any], List[Any]] = {}  # (kind, key) -> [hash, or None once gone; change number]
        self.number = 0
        self._memo: Optional[Tuple[Tuple[int, int], Entities]] = None

    def _scan(self, ents: Entities) -> None:
        now = set()
        for kind, idk in KINDS:
            for x in ents[kind]:
                key = (kind, x[idk])
                now.add(key)
                h = hashlib.md5(json.dumps(x, sort_keys=True, ensure_ascii=False).encode()).digest()
                old = self._seen.get(key)
                if not old or old[0] != h:
                    self.number += 1
                    self._seen[key] = [h, self.number]
        for key, v in self._seen.items():
            if key not in now and v[0] is not None:
                self.number += 1
                v[0], v[1] = None, self.number

    def view(self, at: Tuple[int, int], boot: str, build: Callable[[], Entities], since: Optional[Cursor]) -> Dict[str, Any]:
        """The entities for a page whose copy is at `since` (None: all of it). `at` (rev, agents' version) names the
        project's state now: pages asking after one change get it worked out once."""
        with self._lock:
            if not self._memo or self._memo[0] != at:
                ents = build()
                self._scan(ents)
                self._memo = (at, ents)
            ents = self._memo[1]
            cursor = Cursor(boot, self.number, at[0], at[1])
            if since is None or since.boot != boot or since.number > self.number:
                return {"cursor": str(cursor), "full": True, **{k: list(ents[k]) for k, _ in KINDS}}
            out: Dict[str, Any] = {"cursor": str(cursor), "full": False}
            for kind, idk in KINDS:
                out[kind] = [x for x in ents[kind] if self._seen[(kind, x[idk])][1] > since.number]
            out["removed"] = {kind: [k[1] for k, v in self._seen.items() if k[0] == kind and v[0] is None and v[1] > since.number]
                              for kind, _ in KINDS}
            return out
