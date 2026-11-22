"""Work a waiting session keeps being handed and does not take (B832, r1423): a session that waited for its own task
only was handed a P0 task again and again, every minute for nine hours, and did nothing with it, while Taska counted
the task as having a session on it. Handed the same task, unchanged, three times in a row, the session is taken to
not take it: that task is no longer handed to it nor held for it (until the task changes), and the user is told once.
Pure: the caller says what the task looks like now ("mark") and does what is to be done."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Hashable, Set, Tuple

TIMES = 3  # handed this many times in a row, unchanged, and not taken


@dataclass
class Offers:
    last: Dict[str, Tuple[int, Hashable, int]] = field(default_factory=dict)  # session -> (task, its mark, times)
    told: Set[Tuple[str, int]] = field(default_factory=set)  # (session, task): the user was told

    def handed(self, session: str, n: int, mark: Hashable) -> bool:
        """Task n, looking like `mark`, was handed to `session`; True the time this makes it one it does not take."""
        was = self.last.get(session)
        times = was[2] + 1 if was and was[0] == n and was[1] == mark else 1
        self.last[session] = (n, mark, times)
        if times >= TIMES and (session, n) not in self.told:
            self.told.add((session, n))
            return True
        return False

    def passed(self, session: str, n: int, mark: Hashable) -> bool:
        """Whether `session` does not take task n while it still looks like `mark`."""
        was = self.last.get(session)
        return bool(was and was[0] == n and was[1] == mark and was[2] >= TIMES)

    def changed(self, session: str, n: int, mark: Hashable) -> None:
        """Task n now looks like `mark` because of what Taska itself wrote there (its note to the user)."""
        was = self.last.get(session)
        if was and was[0] == n:
            self.last[session] = (n, mark, was[2])
