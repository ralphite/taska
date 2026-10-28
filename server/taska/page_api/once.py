"""The page's changes come with an id: one sent again after a lost answer is done once and gets the first answer.

The newest answers are kept, per project: those of changes (taken under the project's lock) apart from those of item
moves (taken under the moves' own lock), so a long move does not hold up the project's changes.
"""

from __future__ import annotations

from collections import OrderedDict
from typing import Any, Dict, Optional, Tuple

Answer = Tuple[Dict[str, Any], int]  # the JSON answer and its status


class Answers:
    """The answers by id. The caller holds the lock that makes checking and doing one step."""

    def __init__(self, keep: int = 500):
        self._keep = keep
        self._by_id: "OrderedDict[str, Answer]" = OrderedDict()

    def get(self, cid: str) -> Optional[Answer]:
        return self._by_id.get(cid) if cid else None

    def put(self, cid: str, answer: Answer) -> None:
        if not cid:
            return
        self._by_id[cid] = answer
        while len(self._by_id) > self._keep:
            self._by_id.popitem(last=False)


class PageOnce:
    """One project's kept answers."""

    def __init__(self) -> None:
        self.changes = Answers()
        self.moves = Answers()
